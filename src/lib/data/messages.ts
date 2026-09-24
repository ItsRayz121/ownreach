import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { conversationParticipants, messages, profiles } from "@/db/schema";

const MESSAGE_PAGE_SIZE = 50;

export interface ConversationSummary {
  id: string;
  other: { userId: string; username: string; displayName: string; avatarUrl: string | null } | null;
  lastMessage: { body: string; createdAt: Date; senderId: string } | null;
  unread: boolean;
}

export interface MessageItem {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
}

interface CursorParts {
  createdAt: Date;
  id: string;
}

function decodeCursor(cursor?: string): CursorParts | null {
  if (!cursor) return null;
  try {
    const [ts, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!ts || !id) return null;
    const createdAt = new Date(ts);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function encodeCursor(m: { createdAt: Date; id: string }) {
  return Buffer.from(`${m.createdAt.toISOString()}|${m.id}`).toString("base64url");
}

/** Finds the existing 1:1 conversation between two users, if any. */
export async function findConversationBetween(userA: string, userB: string): Promise<string | null> {
  const cpA = alias(conversationParticipants, "cp_a");
  const cpB = alias(conversationParticipants, "cp_b");

  const [row] = await db
    .select({ conversationId: cpA.conversationId })
    .from(cpA)
    .innerJoin(cpB, eq(cpB.conversationId, cpA.conversationId))
    .where(and(eq(cpA.userId, userA), eq(cpB.userId, userB)))
    .limit(1);

  return row?.conversationId ?? null;
}

export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function getOtherParticipant(conversationId: string, viewerId: string) {
  const [other] = await db
    .select({
      userId: profiles.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(conversationParticipants)
    .innerJoin(profiles, eq(profiles.userId, conversationParticipants.userId))
    .where(and(eq(conversationParticipants.conversationId, conversationId), ne(conversationParticipants.userId, viewerId)))
    .limit(1);
  return other ?? null;
}

/**
 * A user's DM inbox, sorted by most recent activity. Not cursor-paginated —
 * scoped for a personal-inbox-sized list, not an at-scale feed.
 */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const myRows = await db
    .select({ conversationId: conversationParticipants.conversationId, lastReadAt: conversationParticipants.lastReadAt })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));

  if (myRows.length === 0) return [];
  const conversationIds = myRows.map((r) => r.conversationId);
  const lastReadMap = new Map(myRows.map((r) => [r.conversationId, r.lastReadAt]));

  const [latest, otherParticipants] = await Promise.all([
    db
      .selectDistinctOn([messages.conversationId], {
        conversationId: messages.conversationId,
        body: messages.body,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(messages.conversationId, desc(messages.createdAt)),
    db
      .select({ conversationId: conversationParticipants.conversationId, userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(and(inArray(conversationParticipants.conversationId, conversationIds), ne(conversationParticipants.userId, userId))),
  ]);

  const latestMap = new Map(latest.map((m) => [m.conversationId, m]));
  const otherByConversation = new Map(otherParticipants.map((p) => [p.conversationId, p.userId]));

  const otherUserIds = [...new Set(otherParticipants.map((p) => p.userId))];
  const otherProfiles = otherUserIds.length
    ? await db
        .select({
          userId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(inArray(profiles.userId, otherUserIds))
    : [];
  const profileMap = new Map(otherProfiles.map((p) => [p.userId, p]));

  const items: ConversationSummary[] = conversationIds.map((id) => {
    const lastMessage = latestMap.get(id);
    const otherUserId = otherByConversation.get(id);
    const lastReadAt = lastReadMap.get(id);
    return {
      id,
      other: otherUserId ? (profileMap.get(otherUserId) ?? null) : null,
      lastMessage: lastMessage ? { body: lastMessage.body, createdAt: lastMessage.createdAt, senderId: lastMessage.senderId } : null,
      unread: Boolean(lastMessage && lastMessage.senderId !== userId && (!lastReadAt || lastMessage.createdAt > lastReadAt)),
    };
  });

  items.sort((a, b) => (b.lastMessage?.createdAt.getTime() ?? 0) - (a.lastMessage?.createdAt.getTime() ?? 0));
  return items;
}

export async function hasUnreadMessages(userId: string): Promise<boolean> {
  const items = await listConversations(userId);
  return items.some((c) => c.unread);
}

/** Returns messages in ascending (oldest-first) order; `cursor` pages backward for older history. */
export async function listMessages(conversationId: string, cursor?: string) {
  const decoded = decodeCursor(cursor);
  const cursorFilter = decoded
    ? or(
        lt(messages.createdAt, decoded.createdAt),
        and(eq(messages.createdAt, decoded.createdAt), lt(messages.id, decoded.id))
      )
    : undefined;

  const rows = await db
    .select({ id: messages.id, body: messages.body, createdAt: messages.createdAt, senderId: messages.senderId })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), cursorFilter))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(MESSAGE_PAGE_SIZE);

  const last = rows.at(-1);
  const nextCursor = rows.length === MESSAGE_PAGE_SIZE && last ? encodeCursor(last) : null;
  return { items: rows.reverse() as MessageItem[], nextCursor };
}
