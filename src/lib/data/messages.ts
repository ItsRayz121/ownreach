import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { conversations, conversationParticipants, messages, messageReactions, profiles } from "@/db/schema";
import { buildReplyMap, buildReactionMap } from "./reply-reactions";
import { buildContactMap, type SharedContactSummary } from "./shared-contacts";
import { buildPollMap, type PollSummary } from "./polls";
import { buildMediaMap, type MediaSummary } from "./media";

const MESSAGE_PAGE_SIZE = 50;

export interface ConversationSummary {
  id: string;
  other: { userId: string; username: string; displayName: string; avatarUrl: string | null } | null;
  lastMessage: { body: string; createdAt: Date; senderId: string; isPoll: boolean; isContact: boolean } | null;
  unread: boolean;
  status: "accepted" | "pending" | "declined";
  initiatorId: string | null;
}

export interface MessageReactionSummary {
  emoji: string;
  userId: string;
}

export interface MessageItem {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
  deliveredAt: Date | null;
  editedAt: Date | null;
  replyToMessageId: string | null;
  replyExcerpt: string | null;
  replyTo: { id: string; body: string; senderId: string } | null;
  reactions: MessageReactionSummary[];
  sharedContact: SharedContactSummary | null;
  poll: PollSummary | null;
  media: MediaSummary | null;
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

export async function getConversationMeta(conversationId: string) {
  const [row] = await db
    .select({ id: conversations.id, status: conversations.status, initiatorId: conversations.initiatorId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row ?? null;
}

export async function getOtherParticipant(conversationId: string, viewerId: string) {
  const [other] = await db
    .select({
      userId: profiles.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      lastReadAt: conversationParticipants.lastReadAt,
    })
    .from(conversationParticipants)
    .innerJoin(profiles, eq(profiles.userId, conversationParticipants.userId))
    .where(and(eq(conversationParticipants.conversationId, conversationId), ne(conversationParticipants.userId, viewerId)))
    .limit(1);
  return other ?? null;
}

/**
 * A user's DM inbox, sorted by most recent activity. Not cursor-paginated —
 * scoped for a personal-inbox-sized list, not an at-scale feed. Excludes
 * conversations the viewer declined as a message request (the initiator
 * still sees their own copy, see conversationId lookups in actions).
 */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const myRows = await db
    .select({ conversationId: conversationParticipants.conversationId, lastReadAt: conversationParticipants.lastReadAt })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));

  if (myRows.length === 0) return [];
  const conversationIds = myRows.map((r) => r.conversationId);
  const lastReadMap = new Map(myRows.map((r) => [r.conversationId, r.lastReadAt]));

  const [latest, otherParticipants, conversationRows] = await Promise.all([
    db
      .selectDistinctOn([messages.conversationId], {
        conversationId: messages.conversationId,
        body: messages.body,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
        pollId: messages.pollId,
        sharedContactId: messages.sharedContactId,
      })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(messages.conversationId, desc(messages.createdAt)),
    db
      .select({ conversationId: conversationParticipants.conversationId, userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(and(inArray(conversationParticipants.conversationId, conversationIds), ne(conversationParticipants.userId, userId))),
    db
      .select({ id: conversations.id, status: conversations.status, initiatorId: conversations.initiatorId })
      .from(conversations)
      .where(inArray(conversations.id, conversationIds)),
  ]);

  const latestMap = new Map(latest.map((m) => [m.conversationId, m]));
  const otherByConversation = new Map(otherParticipants.map((p) => [p.conversationId, p.userId]));
  const metaMap = new Map(conversationRows.map((c) => [c.id, c]));

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

  const items: ConversationSummary[] = conversationIds
    .map((id) => {
      const lastMessage = latestMap.get(id);
      const otherUserId = otherByConversation.get(id);
      const lastReadAt = lastReadMap.get(id);
      const meta = metaMap.get(id);
      return {
        id,
        other: otherUserId ? (profileMap.get(otherUserId) ?? null) : null,
        lastMessage: lastMessage
          ? {
              body: lastMessage.body,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId,
              isPoll: Boolean(lastMessage.pollId),
              isContact: Boolean(lastMessage.sharedContactId),
            }
          : null,
        unread: Boolean(lastMessage && lastMessage.senderId !== userId && (!lastReadAt || lastMessage.createdAt > lastReadAt)),
        status: meta?.status ?? "accepted",
        initiatorId: meta?.initiatorId ?? null,
      };
    })
    .filter((c) => !(c.status === "declined" && c.initiatorId !== userId));

  items.sort((a, b) => (b.lastMessage?.createdAt.getTime() ?? 0) - (a.lastMessage?.createdAt.getTime() ?? 0));
  return items;
}

/** Lighter-weight than listConversations — skips the profile/other-participant joins, since only the count is needed. */
export async function countUnreadConversations(userId: string): Promise<number> {
  const myRows = await db
    .select({ conversationId: conversationParticipants.conversationId, lastReadAt: conversationParticipants.lastReadAt })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));
  if (myRows.length === 0) return 0;

  const conversationIds = myRows.map((r) => r.conversationId);
  const lastReadMap = new Map(myRows.map((r) => [r.conversationId, r.lastReadAt]));

  const [latest, conversationRows] = await Promise.all([
    db
      .selectDistinctOn([messages.conversationId], {
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(messages.conversationId, desc(messages.createdAt)),
    db
      .select({ id: conversations.id, status: conversations.status, initiatorId: conversations.initiatorId })
      .from(conversations)
      .where(inArray(conversations.id, conversationIds)),
  ]);
  const metaMap = new Map(conversationRows.map((c) => [c.id, c]));

  return latest.filter((m) => {
    const meta = metaMap.get(m.conversationId);
    if (meta?.status === "declined" && meta.initiatorId !== userId) return false;
    const lastReadAt = lastReadMap.get(m.conversationId);
    return m.senderId !== userId && (!lastReadAt || m.createdAt > lastReadAt);
  }).length;
}

/** Scoped to `conversationId` so a caller can't resolve/leak a reply pointing at a message in a different conversation. */
function attachReplyPreviews(conversationId: string, rows: { id: string; body: string; senderId: string; replyToMessageId: string | null }[]) {
  return buildReplyMap(rows, (ids) =>
    db
      .select({ id: messages.id, body: messages.body, senderId: messages.senderId })
      .from(messages)
      .where(and(inArray(messages.id, ids), eq(messages.conversationId, conversationId)))
  );
}

function attachReactions(messageIds: string[]) {
  return buildReactionMap(messageIds, (ids) =>
    db
      .select({ messageId: messageReactions.messageId, emoji: messageReactions.emoji, userId: messageReactions.userId })
      .from(messageReactions)
      .where(inArray(messageReactions.messageId, ids))
  );
}

/** Returns messages in ascending (oldest-first) order; `cursor` pages backward for older history. */
export async function listMessages(conversationId: string, viewerId: string, cursor?: string) {
  const decoded = decodeCursor(cursor);
  const cursorFilter = decoded
    ? or(
        lt(messages.createdAt, decoded.createdAt),
        and(eq(messages.createdAt, decoded.createdAt), lt(messages.id, decoded.id))
      )
    : undefined;

  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      deliveredAt: messages.deliveredAt,
      editedAt: messages.editedAt,
      replyToMessageId: messages.replyToMessageId,
      replyExcerpt: messages.replyExcerpt,
      sharedContactId: messages.sharedContactId,
      pollId: messages.pollId,
      mediaId: messages.mediaId,
    })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), cursorFilter))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(MESSAGE_PAGE_SIZE);

  const last = rows.at(-1);
  const nextCursor = rows.length === MESSAGE_PAGE_SIZE && last ? encodeCursor(last) : null;
  const ordered = rows.reverse();

  const [replyMap, reactionMap, contactMap, pollMap, mediaMap] = await Promise.all([
    attachReplyPreviews(conversationId, ordered),
    attachReactions(ordered.map((m) => m.id)),
    buildContactMap(ordered),
    buildPollMap(ordered, viewerId),
    buildMediaMap(ordered),
  ]);

  const items: MessageItem[] = ordered.map((m) => ({
    ...m,
    replyTo: m.replyToMessageId ? (replyMap.get(m.replyToMessageId) ?? null) : null,
    reactions: reactionMap.get(m.id) ?? [],
    sharedContact: m.sharedContactId ? (contactMap.get(m.sharedContactId) ?? null) : null,
    poll: m.pollId ? (pollMap.get(m.pollId) ?? null) : null,
    media: m.mediaId ? (mediaMap.get(m.mediaId) ?? null) : null,
  }));

  return { items, nextCursor };
}
