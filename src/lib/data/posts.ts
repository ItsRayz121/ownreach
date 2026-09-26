import "server-only";
import { and, desc, eq, inArray, isNull, lt, or, count, sql } from "drizzle-orm";
import { db } from "@/db";
import { posts, postMedia, postReactions, comments, bookmarks, profiles, follows } from "@/db/schema";

const PAGE_SIZE = 20;

export interface FeedPost {
  id: string;
  body: string;
  createdAt: Date;
  edited: boolean;
  author: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isCreator: boolean;
  };
  media: { id: string; url: string; width: number | null; height: number | null; altText: string | null }[];
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
  bookmarkedByViewer: boolean;
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

function encodeCursor(post: { createdAt: Date; id: string }) {
  return Buffer.from(`${post.createdAt.toISOString()}|${post.id}`).toString("base64url");
}

async function hydratePosts(
  rows: { id: string; body: string; createdAt: Date; edited: boolean; author: FeedPost["author"] }[],
  viewerId?: string
): Promise<FeedPost[]> {
  if (rows.length === 0) return [];
  const postIds = rows.map((r) => r.id);

  const [mediaRows, likeCounts, commentCounts, viewerLikes, viewerBookmarks] = await Promise.all([
    db.select().from(postMedia).where(inArray(postMedia.postId, postIds)),
    db
      .select({ postId: postReactions.postId, value: count() })
      .from(postReactions)
      .where(inArray(postReactions.postId, postIds))
      .groupBy(postReactions.postId),
    db
      .select({ postId: comments.postId, value: count() })
      .from(comments)
      .where(and(inArray(comments.postId, postIds), isNull(comments.deletedAt)))
      .groupBy(comments.postId),
    viewerId
      ? db
          .select({ postId: postReactions.postId })
          .from(postReactions)
          .where(and(inArray(postReactions.postId, postIds), eq(postReactions.userId, viewerId)))
      : Promise.resolve([]),
    viewerId
      ? db
          .select({ postId: bookmarks.postId })
          .from(bookmarks)
          .where(and(inArray(bookmarks.postId, postIds), eq(bookmarks.userId, viewerId)))
      : Promise.resolve([]),
  ]);

  const likeCountMap = new Map(likeCounts.map((r) => [r.postId, r.value]));
  const commentCountMap = new Map(commentCounts.map((r) => [r.postId, r.value]));
  const likedSet = new Set(viewerLikes.map((r) => r.postId));
  const bookmarkedSet = new Set(viewerBookmarks.map((r) => r.postId));

  return rows.map((row) => ({
    ...row,
    media: mediaRows.filter((m) => m.postId === row.id),
    likeCount: likeCountMap.get(row.id) ?? 0,
    commentCount: commentCountMap.get(row.id) ?? 0,
    likedByViewer: likedSet.has(row.id),
    bookmarkedByViewer: bookmarkedSet.has(row.id),
  }));
}

const authorSelection = {
  userId: profiles.userId,
  username: profiles.username,
  displayName: profiles.displayName,
  avatarUrl: profiles.avatarUrl,
  isCreator: profiles.isCreator,
};

export async function getFeed(opts: { scope: "for-you" | "following"; viewerId?: string; cursor?: string }) {
  const cursor = decodeCursor(opts.cursor);
  const cursorFilter = cursor
    ? or(
        lt(posts.createdAt, cursor.createdAt),
        and(eq(posts.createdAt, cursor.createdAt), lt(posts.id, cursor.id))
      )
    : undefined;

  const conditions = [isNull(posts.deletedAt)];
  if (cursorFilter) conditions.push(cursorFilter);

  if (opts.scope === "following" && opts.viewerId) {
    const followingIds = db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, opts.viewerId));
    conditions.push(or(inArray(posts.authorId, followingIds), eq(posts.authorId, opts.viewerId))!);
  }

  const rows = await db
    .select({
      id: posts.id,
      body: posts.body,
      createdAt: posts.createdAt,
      edited: posts.edited,
      author: authorSelection,
    })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(PAGE_SIZE);

  const items = await hydratePosts(rows, opts.viewerId);
  const last = rows.at(-1);
  return { items, nextCursor: rows.length === PAGE_SIZE && last ? encodeCursor(last) : null };
}

export async function getPostsByAuthor(authorId: string, viewerId?: string, cursor?: string) {
  const decoded = decodeCursor(cursor);
  const cursorFilter = decoded
    ? or(
        lt(posts.createdAt, decoded.createdAt),
        and(eq(posts.createdAt, decoded.createdAt), lt(posts.id, decoded.id))
      )
    : undefined;

  const rows = await db
    .select({
      id: posts.id,
      body: posts.body,
      createdAt: posts.createdAt,
      edited: posts.edited,
      author: authorSelection,
    })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .where(and(eq(posts.authorId, authorId), isNull(posts.deletedAt), cursorFilter))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(PAGE_SIZE);

  const items = await hydratePosts(rows, viewerId);
  const last = rows.at(-1);
  return { items, nextCursor: rows.length === PAGE_SIZE && last ? encodeCursor(last) : null };
}

export async function getPostById(id: string, viewerId?: string): Promise<FeedPost | null> {
  const [row] = await db
    .select({
      id: posts.id,
      body: posts.body,
      createdAt: posts.createdAt,
      edited: posts.edited,
      author: authorSelection,
    })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .limit(1);

  if (!row) return null;
  const [hydrated] = await hydratePosts([row], viewerId);
  return hydrated;
}

export async function getBookmarkedPosts(viewerId: string, cursor?: string) {
  // Ordered by when the post was bookmarked, not when it was authored, so the
  // cursor is (bookmarks.createdAt, bookmarks.postId) rather than the
  // posts-table cursor other feeds use.
  const decoded = decodeCursor(cursor);
  const cursorFilter = decoded
    ? or(
        lt(bookmarks.createdAt, decoded.createdAt),
        and(eq(bookmarks.createdAt, decoded.createdAt), lt(bookmarks.postId, decoded.id))
      )
    : undefined;

  const rows = await db
    .select({
      id: posts.id,
      body: posts.body,
      createdAt: posts.createdAt,
      edited: posts.edited,
      author: authorSelection,
      bookmarkedAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(posts, eq(posts.id, bookmarks.postId))
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .where(and(eq(bookmarks.userId, viewerId), isNull(posts.deletedAt), cursorFilter))
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.postId))
    .limit(PAGE_SIZE);

  const items = await hydratePosts(rows, viewerId);
  const last = rows.at(-1);
  const nextCursor = rows.length === PAGE_SIZE && last ? encodeCursor({ createdAt: last.bookmarkedAt, id: last.id }) : null;
  return { items, nextCursor };
}

export async function searchPosts(query: string, viewerId?: string) {
  const rows = await db
    .select({
      id: posts.id,
      body: posts.body,
      createdAt: posts.createdAt,
      edited: posts.edited,
      author: authorSelection,
    })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .where(and(isNull(posts.deletedAt), sql`${posts.body} ILIKE ${"%" + query + "%"}`))
    .orderBy(desc(posts.createdAt))
    .limit(PAGE_SIZE);

  return hydratePosts(rows, viewerId);
}
