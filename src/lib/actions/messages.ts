"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversations, conversationParticipants, messages } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { findConversationBetween, isParticipant, listMessages } from "@/lib/data/messages";
import { publishToChannel } from "@/lib/realtime/ably-server";

export async function startConversation(targetUserId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to message someone.");
  if (session.userId === targetUserId) throw new Error("You can't message yourself.");

  const existing = await findConversationBetween(session.userId, targetUserId);
  if (existing) return { id: existing };

  const id = await db.transaction(async (tx) => {
    const [conversation] = await tx.insert(conversations).values({}).returning({ id: conversations.id });
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
});

export async function sendMessage(input: z.infer<typeof sendMessageSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to message someone.");
  await checkRateLimit("message:send", session.userId, { limit: 60, window: "10 m" });

  const parsed = sendMessageSchema.parse(input);
  const participant = await isParticipant(parsed.conversationId, session.userId);
  if (!participant) throw new Error("Conversation not found.");

  const [message] = await db
    .insert(messages)
    .values({
      conversationId: parsed.conversationId,
      senderId: session.userId,
      body: parsed.body,
    })
    .returning({ id: messages.id, body: messages.body, createdAt: messages.createdAt, senderId: messages.senderId });

  await publishToChannel(`conversation:${parsed.conversationId}`, "message", {
    id: message.id,
    body: message.body,
    senderId: message.senderId,
    createdAt: message.createdAt.toISOString(),
  });

  revalidatePath(`/messages/${parsed.conversationId}`);
  revalidatePath("/messages");
  return message;
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

  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, session.userId)));
}
