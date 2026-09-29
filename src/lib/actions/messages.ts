"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversations, conversationParticipants, messages, messageReactions, messagePolls, messagePollOptions, messageMedia, follows, profiles } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { findConversationBetween, isParticipant, listMessages, getConversationMeta } from "@/lib/data/messages";
import { searchProfiles } from "@/lib/data/profiles";
import { MESSAGE_REQUEST_CAP } from "@/lib/message-requests";
import { publishToChannel } from "@/lib/realtime/ably-server";
import { isMessageReactionEmoji } from "@/lib/reactions";
import { toggleReactionCore } from "@/lib/actions/reaction-toggle";
import { mediaExpiryDate } from "@/lib/media-retention";
import { assertOwnMessageMedia } from "@/lib/media-ownership";
import { cloudinary } from "@/lib/cloudinary";
import { isUniqueViolation } from "@/lib/db-errors";
import { isWithinEditWindow, EDIT_WINDOW_EXPIRED_MESSAGE } from "@/lib/message-edit";
import type { MediaSummary } from "@/lib/data/media";

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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Enforces the message-request gate (declined-blocks-initiator, pending-cap
 * on the initiator, implicit-accept on a reply) inside `tx` — shared by
 * every action that inserts a new message/poll/contact-share row, not just
 * `sendMessage`, so none of them can bypass the request system by calling a
 * different action. Caller inserts the row itself after this resolves.
 */
async function gateMessageRequest(tx: Tx, conversationId: string, userId: string): Promise<{ becameAccepted: boolean }> {
  // Serializes concurrent sends into this conversation so the cap check
  // below (and the implicit-accept flip) can't race across a double-tap or
  // multiple open tabs/actions.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${conversationId}, 1))`);

  const [meta] = await tx
    .select({ status: conversations.status, initiatorId: conversations.initiatorId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!meta) throw new Error("Conversation not found.");
  // Declining only blocks the initiator from sending more — the recipient
  // (who declined) can still message back, which implicitly re-accepts the
  // conversation, mirroring the pending->accepted implicit-accept below.
  if (meta.status === "declined" && userId === meta.initiatorId) {
    throw new Error("This message request was declined.");
  }

  let becameAccepted = false;
  if (meta.status === "pending") {
    if (userId === meta.initiatorId) {
      const sentSoFar = await tx.select({ id: messages.id }).from(messages).where(and(eq(messages.conversationId, conversationId), eq(messages.senderId, userId)));
      if (sentSoFar.length >= MESSAGE_REQUEST_CAP) {
        throw new Error("Your message request is limited until they accept.");
      }
    } else {
      // The recipient replying implicitly accepts the request.
      await tx.update(conversations).set({ status: "accepted" }).where(eq(conversations.id, conversationId));
      becameAccepted = true;
    }
  } else if (meta.status === "declined") {
    // The recipient sending anyway implicitly re-accepts.
    await tx.update(conversations).set({ status: "accepted" }).where(eq(conversations.id, conversationId));
    becameAccepted = true;
  }

  return { becameAccepted };
}

async function publishAcceptedIfNeeded(conversationId: string, becameAccepted: boolean) {
  if (!becameAccepted) return;
  await publishToChannel(`conversation:${conversationId}`, "request-status", { status: "accepted" });
}

const sendMessageSchema = z
  .object({
    conversationId: z.string().uuid(),
    body: z.string().trim().max(2000, "Messages are capped at 2000 characters."),
    replyToMessageId: z.string().uuid().optional(),
    replyExcerpt: z.string().trim().max(500).optional(),
    mediaUrl: z
      .string()
      .url()
      .refine((url) => {
        try {
          return new URL(url).hostname === "res.cloudinary.com";
        } catch {
          // .url() already rejects most malformed input, but refine()
          // still runs even when an earlier check on the same schema
          // failed — without this catch, an edge case that slips past
          // .url() but still fails `new URL()` would throw a raw
          // TypeError instead of a normal validation error.
          return false;
        }
      }, "Media must be uploaded through Cloudinary.")
      .optional(),
    mediaPublicId: z.string().min(1).max(300).optional(),
    mediaWidth: z.number().int().positive().optional(),
    mediaHeight: z.number().int().positive().optional(),
  })
  // A caption-less image is a valid send — only reject the fully-empty case.
  .refine((v) => v.body.length > 0 || Boolean(v.mediaUrl), { message: "Write something or attach an image.", path: ["body"] })
  .refine((v) => !v.mediaUrl || Boolean(v.mediaPublicId), { message: "Missing media reference.", path: ["mediaPublicId"] });

export async function sendMessage(input: z.infer<typeof sendMessageSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to message someone.");
  await checkRateLimit("message:send", session.userId, { limit: 60, window: "10 m" });

  const parsed = sendMessageSchema.parse(input);
  if (parsed.mediaUrl) assertOwnMessageMedia(session.userId, parsed.mediaUrl, parsed.mediaPublicId!);
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

  const { message, becameAccepted, media } = await (async () => {
    try {
      return await db.transaction(async (tx) => {
        const { becameAccepted } = await gateMessageRequest(tx, parsed.conversationId, session.userId);

        let mediaId: string | undefined;
        let media: MediaSummary | null = null;
        if (parsed.mediaUrl) {
          const [row] = await tx
            .insert(messageMedia)
            .values({
              uploaderId: session.userId,
              url: parsed.mediaUrl,
              publicId: parsed.mediaPublicId,
              width: parsed.mediaWidth,
              height: parsed.mediaHeight,
              expiresAt: mediaExpiryDate("dm"),
            })
            .returning({ id: messageMedia.id, url: messageMedia.url, width: messageMedia.width, height: messageMedia.height });
          mediaId = row.id;
          media = { url: row.url, width: row.width, height: row.height, removed: false };
        }

        const [inserted] = await tx
          .insert(messages)
          .values({
            conversationId: parsed.conversationId,
            senderId: session.userId,
            body: parsed.body,
            replyToMessageId: replyTo?.id,
            replyExcerpt: parsed.replyExcerpt,
            mediaId,
          })
          .returning({
            id: messages.id,
            body: messages.body,
            createdAt: messages.createdAt,
            senderId: messages.senderId,
            replyToMessageId: messages.replyToMessageId,
            replyExcerpt: messages.replyExcerpt,
          });

        return { message: inserted, becameAccepted, media };
      });
    } catch (err) {
      // messageMedia.publicId is uniquely indexed (db/schema/media.ts) —
      // this is the one row a replayed/duplicated send with the same
      // attachment would collide on.
      if (isUniqueViolation(err)) throw new Error("That photo was already sent.");
      throw err;
    }
  })();

  await publishToChannel(`conversation:${parsed.conversationId}`, "message", {
    id: message.id,
    body: message.body,
    senderId: message.senderId,
    createdAt: message.createdAt.toISOString(),
    replyToMessageId: message.replyToMessageId,
    replyExcerpt: message.replyExcerpt,
    media,
  });
  await publishAcceptedIfNeeded(parsed.conversationId, becameAccepted);

  revalidatePath(`/messages/${parsed.conversationId}`);
  revalidatePath("/messages");
  return { ...message, deliveredAt: null, editedAt: null, replyTo, reactions: [], sharedContact: null, poll: null, media };
}

export async function loadOlderMessages(conversationId: string, cursor: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const participant = await isParticipant(conversationId, session.userId);
  if (!participant) throw new Error("Conversation not found.");

  return listMessages(conversationId, session.userId, cursor);
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

  revalidatePath("/(main)", "layout");
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

const editMessageSchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first.").max(2000, "Messages are capped at 2000 characters."),
});

export async function editMessage(input: z.infer<typeof editMessageSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");
  await checkRateLimit("message:send", session.userId, { limit: 60, window: "10 m" });
  const parsed = editMessageSchema.parse(input);

  const [existing] = await db
    .select({
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      pollId: messages.pollId,
      sharedContactId: messages.sharedContactId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.id, parsed.messageId))
    .limit(1);
  if (!existing || existing.senderId !== session.userId) throw new Error("Message not found.");
  if (existing.pollId || existing.sharedContactId) throw new Error("That message can't be edited.");
  if (!isWithinEditWindow(existing.createdAt)) throw new Error(EDIT_WINDOW_EXPIRED_MESSAGE);

  const editedAt = new Date();
  await db.update(messages).set({ body: parsed.body, editedAt }).where(eq(messages.id, parsed.messageId));

  await publishToChannel(`conversation:${existing.conversationId}`, "edited", {
    messageId: parsed.messageId,
    body: parsed.body,
    editedAt: editedAt.toISOString(),
  });

  revalidatePath(`/messages/${existing.conversationId}`);
  return { body: parsed.body, editedAt };
}

/**
 * Deletes a message for everyone in the conversation. Only the sender can —
 * a site admin has no business removing someone's private DM. Reactions
 * cascade; replies keep their quoted excerpt (reply_to_message_id is
 * "set null"); an attached poll or photo is cleaned up with the message.
 */
export async function deleteMessage(messageId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");
  await checkRateLimit("message:delete", session.userId, { limit: 60, window: "10 m" });

  const [existing] = await db
    .select({ conversationId: messages.conversationId, senderId: messages.senderId, pollId: messages.pollId, mediaId: messages.mediaId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!existing || existing.senderId !== session.userId) throw new Error("Message not found.");

  const [media] = existing.mediaId
    ? await db.select({ publicId: messageMedia.publicId }).from(messageMedia).where(eq(messageMedia.id, existing.mediaId)).limit(1)
    : [];

  await db.delete(messages).where(eq(messages.id, messageId));
  if (existing.pollId) await db.delete(messagePolls).where(eq(messagePolls.id, existing.pollId));
  if (existing.mediaId) await db.delete(messageMedia).where(eq(messageMedia.id, existing.mediaId));
  // Awaited for the same serverless reason as deleteMessageMedia below.
  if (media?.publicId) await cloudinary.uploader.destroy(media.publicId).catch(() => {});

  await publishToChannel(`conversation:${existing.conversationId}`, "deleted", { messageId });
  revalidatePath(`/messages/${existing.conversationId}`);
  revalidatePath("/messages");
}

/**
 * Manual per-image delete, independent of the retention cron
 * (api/cron/purge-expired-media) — same "sender, or a site admin" authority
 * as deletePost. Soft-deletes the messageMedia row rather than the message
 * itself, so the bubble still renders (with its caption, if any) but the
 * photo shows as removed.
 */
export async function deleteMessageMedia(messageId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const [existing] = await db
    .select({ conversationId: messages.conversationId, senderId: messages.senderId, mediaId: messages.mediaId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!existing) throw new Error("Message not found.");
  if (existing.senderId !== session.userId && session.role !== "admin") {
    throw new Error("You can only delete your own photos.");
  }
  if (!existing.mediaId) throw new Error("This message has no photo.");

  const [media] = await db
    .select({ publicId: messageMedia.publicId, removedAt: messageMedia.removedAt })
    .from(messageMedia)
    .where(eq(messageMedia.id, existing.mediaId))
    .limit(1);
  if (!media || media.removedAt) return;

  await db
    .update(messageMedia)
    .set({ removedAt: new Date(), url: null, publicId: null, width: null, height: null })
    .where(eq(messageMedia.id, existing.mediaId));

  if (media.publicId) {
    // Awaited (unlike publishToChannel below) — on a serverless runtime an
    // un-awaited destroy() can be cut short once this action's own promise
    // resolves, silently leaving the Cloudinary asset undeleted despite the
    // DB row already saying "removed".
    await cloudinary.uploader.destroy(media.publicId).catch(() => {});
  }

  await publishToChannel(`conversation:${existing.conversationId}`, "media-removed", { messageId });
  revalidatePath(`/messages/${existing.conversationId}`);
}

export async function searchContacts(query: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");
  await checkRateLimit("contact:search", session.userId, { limit: 60, window: "1 m" });
  if (query.trim().length === 0) return [];

  const { matches } = await searchProfiles(query, { excludeUserId: session.userId });
  return matches.slice(0, 10).map((p) => ({ userId: p.userId, username: p.username, displayName: p.displayName, avatarUrl: p.avatarUrl }));
}

export async function shareContact(conversationId: string, contactUserId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");
  await checkRateLimit("message:send", session.userId, { limit: 60, window: "10 m" });
  if (contactUserId === session.userId) throw new Error("You can't share yourself.");

  const participant = await isParticipant(conversationId, session.userId);
  if (!participant) throw new Error("Conversation not found.");

  const [contact] = await db
    .select({ userId: profiles.userId, username: profiles.username, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.userId, contactUserId))
    .limit(1);
  if (!contact) throw new Error("That user could not be found.");

  const { message, becameAccepted } = await db.transaction(async (tx) => {
    const { becameAccepted } = await gateMessageRequest(tx, conversationId, session.userId);
    const [message] = await tx
      .insert(messages)
      .values({ conversationId, senderId: session.userId, body: "", sharedContactId: contactUserId })
      .returning({ id: messages.id, createdAt: messages.createdAt, senderId: messages.senderId });
    return { message, becameAccepted };
  });

  await publishToChannel(`conversation:${conversationId}`, "message", {
    id: message.id,
    body: "",
    senderId: message.senderId,
    createdAt: message.createdAt.toISOString(),
    replyToMessageId: null,
    replyExcerpt: null,
    sharedContact: contact,
  });
  await publishAcceptedIfNeeded(conversationId, becameAccepted);

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return {
    id: message.id,
    body: "",
    createdAt: message.createdAt,
    senderId: message.senderId,
    deliveredAt: null,
    editedAt: null,
    replyToMessageId: null,
    replyExcerpt: null,
    replyTo: null,
    reactions: [],
    sharedContact: contact,
    poll: null,
    media: null,
  };
}

const createPollSchema = z.object({
  conversationId: z.string().uuid(),
  question: z.string().trim().min(1, "Give the poll a question.").max(300, "Keep the question under 300 characters."),
  options: z
    .array(z.string().trim().min(1).max(100))
    .min(2, "Add at least 2 options.")
    .max(10, "Polls are capped at 10 options.")
    .refine((opts) => new Set(opts.map((o) => o.toLowerCase())).size === opts.length, "Options must be unique."),
  allowMultiple: z.boolean().default(false),
});

export async function createPoll(input: z.infer<typeof createPollSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");
  await checkRateLimit("message:send", session.userId, { limit: 60, window: "10 m" });
  const parsed = createPollSchema.parse(input);

  const participant = await isParticipant(parsed.conversationId, session.userId);
  if (!participant) throw new Error("Conversation not found.");

  const { message, poll, options, becameAccepted } = await db.transaction(async (tx) => {
    const { becameAccepted } = await gateMessageRequest(tx, parsed.conversationId, session.userId);
    const [poll] = await tx
      .insert(messagePolls)
      .values({ creatorId: session.userId, question: parsed.question, allowMultiple: parsed.allowMultiple })
      .returning();
    const options = await tx
      .insert(messagePollOptions)
      .values(parsed.options.map((text, position) => ({ pollId: poll.id, text, position })))
      .returning({ id: messagePollOptions.id, text: messagePollOptions.text });
    const [message] = await tx
      .insert(messages)
      .values({ conversationId: parsed.conversationId, senderId: session.userId, body: "", pollId: poll.id })
      .returning({ id: messages.id, createdAt: messages.createdAt, senderId: messages.senderId });
    return { message, poll, options, becameAccepted };
  });

  const pollPayload = {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    options: options.map((o) => ({ id: o.id, text: o.text, voteCount: 0, votedByMe: false })),
  };

  await publishToChannel(`conversation:${parsed.conversationId}`, "message", {
    id: message.id,
    body: "",
    senderId: message.senderId,
    createdAt: message.createdAt.toISOString(),
    replyToMessageId: null,
    replyExcerpt: null,
    poll: pollPayload,
  });
  await publishAcceptedIfNeeded(parsed.conversationId, becameAccepted);

  revalidatePath(`/messages/${parsed.conversationId}`);
  revalidatePath("/messages");
  return {
    id: message.id,
    body: "",
    createdAt: message.createdAt,
    senderId: message.senderId,
    deliveredAt: null,
    editedAt: null,
    replyToMessageId: null,
    replyExcerpt: null,
    replyTo: null,
    reactions: [],
    sharedContact: null,
    poll: pollPayload,
    media: null,
  };
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
