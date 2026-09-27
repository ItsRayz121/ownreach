"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversations, conversationParticipants, messages, messageReactions, follows } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { findConversationBetween, isParticipant, listMessages, getConversationMeta } from "@/lib/data/messages";
import { MESSAGE_REQUEST_CAP } from "@/lib/message-requests";
import { publishToChannel } from "@/lib/realtime/ably-server";
import { isMessageReactionEmoji } from "@/lib/reactions";
import { toggleReactionCore } from "@/lib/actions/reaction-toggle";

async function isMutualFollow(userA: string, userB: string): Promise<boolean> {
  const rows = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(
      sql`(${follows.followerId} = ${userA} AND ${follows.followingId} = ${userB}) OR (${follows.followerId} = ${userB} AND ${follows.followingId} = ${userA})`
    );
  return rows.length === 2;
}

export async function startConversation(targetUserId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to message someone.");
  if (session.userId === targetUserId) throw new Error("You can't message yourself.");

  const existing = await findConversationBetween(session.userId, targetUserId);
  if (existing) return { id: existing };

  const mutual = await isMutualFollow(session.userId, targetUserId);

  const id = await db.transaction(async (tx) => {
    // There's no uniqueness constraint on a participant pair (see the note
    // in db/schema/messages.ts), so two concurrent calls for the same pair
    // could each pass the "no existing conversation" check above and create
    // duplicate conversations. Serialize with a transaction-scoped advisory
    // lock keyed by the sorted pair, then re-check before inserting.
    const [a, b] = [session.userId, targetUserId].sort();
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${a} || ':' || ${b}, 0))`);

    const raced = await findConversationBetween(session.userId, targetUserId);
    if (raced) return raced;

    const [conversation] = await tx
      .insert(conversations)
      .values(mutual ? {} : { status: "pending", initiatorId: session.userId })
      .returning({ id: conversations.id });
    await tx.insert(conversationParticipants).values([
      { conversationId: conversation.id, userId: session.userId },
      { conversationId: conversation.id, userId: targetUserId },
    ]);
    return conversation.id;
  });

  return { id };
}

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first.").max(2000, "Messages are capped at 2000 characters."),
  replyToMessageId: z.string().uuid().optional(),
  replyExcerpt: z.string().trim().max(500).optional(),
});

export async function sendMessage(input: z.infer<typeof sendMessageSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to message someone.");
  await checkRateLimit("message:send", session.userId, { limit: 60, window: "10 m" });

  const parsed = sendMessageSchema.parse(input);
  const participant = await isParticipant(parsed.conversationId, session.userId);
  if (!participant) throw new Error("Conversation not found.");

  // Scoped to this conversation so a caller can't quote/leak a message id
  // from a different conversation they happen to also be a participant in.
  let replyTo: { id: string; body: string; senderId: string } | null = null;
  if (parsed.replyToMessageId) {
    const [original] = await db
      .select({ id: messages.id, body: messages.body, senderId: messages.senderId })
      .from(messages)
      .where(and(eq(messages.id, parsed.replyToMessageId), eq(messages.conversationId, parsed.conversationId)))
      .limit(1);
    if (!original) throw new Error("The message you're replying to could not be found.");
    replyTo = original;
  }

  const { message, becameAccepted } = await db.transaction(async (tx) => {
    // Serializes concurrent sends into this conversation so the
    // message-request cap check below (and the implicit-accept flip) can't
    // race across a double-tap or multiple open tabs.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${parsed.conversationId}, 1))`);

    const [meta] = await tx
      .select({ status: conversations.status, initiatorId: conversations.initiatorId })
      .from(conversations)
      .where(eq(conversations.id, parsed.conversationId))
      .limit(1);
    if (!meta) throw new Error("Conversation not found.");
    // Declining only blocks the initiator from sending more — the recipient
    // (who declined) can still message back, which implicitly re-accepts the
    // conversation, mirroring the pending->accepted implicit-accept below.
    if (meta.status === "declined" && session.userId === meta.initiatorId) {
      throw new Error("This message request was declined.");
    }

    let becameAccepted = false;
    if (meta.status === "pending") {
      if (session.userId === meta.initiatorId) {
        const sentSoFar = await tx
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.conversationId, parsed.conversationId), eq(messages.senderId, session.userId)));
        if (sentSoFar.length >= MESSAGE_REQUEST_CAP) {
          throw new Error("Your message request is limited until they accept.");
        }
      } else {
        // The recipient replying implicitly accepts the request.
        await tx.update(conversations).set({ status: "accepted" }).where(eq(conversations.id, parsed.conversationId));
        becameAccepted = true;
      }
    } else if (meta.status === "declined") {
      // The recipient sending anyway implicitly re-accepts.
      await tx.update(conversations).set({ status: "accepted" }).where(eq(conversations.id, parsed.conversationId));
      becameAccepted = true;
    }

    const [inserted] = await tx
      .insert(messages)
      .values({
        conversationId: parsed.conversationId,
        senderId: session.userId,
        body: parsed.body,
        replyToMessageId: replyTo?.id,
        replyExcerpt: parsed.replyExcerpt,
      })
      .returning({
        id: messages.id,
        body: messages.body,
        createdAt: messages.createdAt,
        senderId: messages.senderId,
        replyToMessageId: messages.replyToMessageId,
        replyExcerpt: messages.replyExcerpt,
      });

    return { message: inserted, becameAccepted };
  });

  await publishToChannel(`conversation:${parsed.conversationId}`, "message", {
    id: message.id,
    body: message.body,
    senderId: message.senderId,
    createdAt: message.createdAt.toISOString(),
    replyToMessageId: message.replyToMessageId,
    replyExcerpt: message.replyExcerpt,
  });
  if (becameAccepted) {
    await publishToChannel(`conversation:${parsed.conversationId}`, "request-status", { status: "accepted" });
  }

  revalidatePath(`/messages/${parsed.conversationId}`);
  revalidatePath("/messages");
  return { ...message, deliveredAt: null, replyTo, reactions: [] };
}

export async function loadOlderMessages(conversationId: string, cursor: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const participant = await isParticipant(conversationId, session.userId);
  if (!participant) throw new Error("Conversation not found.");

  return listMessages(conversationId, cursor);
}

export async function markConversationRead(conversationId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const participant = await isParticipant(conversationId, session.userId);
  if (!participant) throw new Error("Conversation not found.");

  const readAt = new Date();
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: readAt })
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, session.userId)));

  await publishToChannel(`conversation:${conversationId}`, "read", {
    userId: session.userId,
    readAt: readAt.toISOString(),
  });
}

/** Marks messages from the other participant as delivered to the caller. */
export async function markMessagesDelivered(conversationId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const participant = await isParticipant(conversationId, session.userId);
  if (!participant) throw new Error("Conversation not found.");

  const updated = await db
    .update(messages)
    .set({ deliveredAt: new Date() })
    .where(and(eq(messages.conversationId, conversationId), ne(messages.senderId, session.userId), isNull(messages.deliveredAt)))
    .returning({ id: messages.id });

  if (updated.length > 0) {
    await publishToChannel(`conversation:${conversationId}`, "delivered", {
      messageIds: updated.map((m) => m.id),
    });
  }
}

export async function toggleMessageReaction(messageId: string, emoji: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to react.");
  if (!isMessageReactionEmoji(emoji)) throw new Error("Unsupported reaction.");

  const [message] = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!message) throw new Error("Message not found.");

  const [participant, [existing]] = await Promise.all([
    isParticipant(message.conversationId, session.userId),
    db
      .select()
      .from(messageReactions)
      .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, session.userId)))
      .limit(1),
  ]);
  if (!participant) throw new Error("Message not found.");

  const action = await toggleReactionCore({
    emoji,
    findExisting: async () => existing,
    remove: () => db.delete(messageReactions).where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, session.userId))),
    upsert: () =>
      db
        .insert(messageReactions)
        .values({ messageId, userId: session.userId, emoji })
        .onConflictDoUpdate({ target: [messageReactions.messageId, messageReactions.userId], set: { emoji } }),
  });

  await publishToChannel(`conversation:${message.conversationId}`, "reaction", {
    messageId,
    userId: session.userId,
    emoji,
    action,
  });

  return { action, emoji };
}

async function requireNonInitiator(conversationId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");
  const [participant, meta] = await Promise.all([isParticipant(conversationId, session.userId), getConversationMeta(conversationId)]);
  if (!participant || !meta) throw new Error("Conversation not found.");
  if (meta.initiatorId === session.userId) throw new Error("You can't do that with your own message request.");
  return { session, meta };
}

export async function acceptMessageRequest(conversationId: string) {
  const { meta } = await requireNonInitiator(conversationId);
  if (meta.status !== "pending") return;

  await db.update(conversations).set({ status: "accepted" }).where(eq(conversations.id, conversationId));
  await publishToChannel(`conversation:${conversationId}`, "request-status", { status: "accepted" });
  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
}

export async function declineMessageRequest(conversationId: string) {
  const { meta } = await requireNonInitiator(conversationId);
  if (meta.status !== "pending") return;

  await db.update(conversations).set({ status: "declined" }).where(eq(conversations.id, conversationId));
  await publishToChannel(`conversation:${conversationId}`, "request-status", { status: "declined" });
  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
}
