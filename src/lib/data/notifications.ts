import "server-only";
import { and, count, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { notifications, profiles, type Notification } from "@/db/schema";

const PAGE_SIZE = 30;

export interface NotificationItem {
  id: string;
  type: Notification["type"];
  createdAt: Date;
  read: boolean;
  postId: string | null;
  commentId: string | null;
  actor: { userId: string; username: string; displayName: string; avatarUrl: string | null } | null;
}

interface CursorParts {
  createdAt: Date;
  id: string;
}

function decodeCursor(cursor?: string): CursorParts | null {
  if (!cursor) return null;
  try {
    const [ts, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    return { createdAt: new Date(ts), id };
  } catch {
    return null;
  }
}

function encodeCursor(n: { createdAt: Date; id: string }) {
  return Buffer.from(`${n.createdAt.toISOString()}|${n.id}`).toString("base64url");
}

export async function listNotifications(recipientId: string, cursor?: string) {
  const decoded = decodeCursor(cursor);
  const cursorFilter = decoded
    ? or(
        lt(notifications.createdAt, decoded.createdAt),
        and(eq(notifications.createdAt, decoded.createdAt), lt(notifications.id, decoded.id))
      )
    : undefined;

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      createdAt: notifications.createdAt,
      read: notifications.read,
      postId: notifications.postId,
      commentId: notifications.commentId,
      actorId: notifications.actorId,
    })
    .from(notifications)
    .where(and(eq(notifications.recipientId, recipientId), cursorFilter))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(PAGE_SIZE);

  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id)))];
  const actorRows = actorIds.length
    ? await db
        .select({
          userId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(inArray(profiles.userId, actorIds))
    : [];
  const actorMap = new Map(actorRows.map((a) => [a.userId, a]));

  const items: NotificationItem[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    createdAt: r.createdAt,
    read: r.read,
    postId: r.postId,
    commentId: r.commentId,
    actor: r.actorId ? (actorMap.get(r.actorId) ?? null) : null,
  }));

  const last = rows.at(-1);
  const nextCursor = rows.length === PAGE_SIZE && last ? encodeCursor(last) : null;
  return { items, nextCursor };
}

export async function unreadNotificationCount(recipientId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientId, recipientId), eq(notifications.read, false)));
  return row?.value ?? 0;
}
