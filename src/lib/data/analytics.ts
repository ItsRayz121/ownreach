import "server-only";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, follows, posts, postReactions, profiles } from "@/db/schema";

// No view-tracking exists yet, so these are scoped to what's derivable from
// existing tables: follower growth, per-post engagement, and simple totals.

export interface FollowerGrowthPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

/** One row per day in the last `days` days, including zero-count days. */
export async function getFollowerGrowth(userId: string, days = 30): Promise<FollowerGrowthPoint[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const rows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${follows.createdAt}), 'YYYY-MM-DD')`,
      count: count(),
    })
    .from(follows)
    .where(and(eq(follows.followingId, userId), gte(follows.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${follows.createdAt})`)
    .orderBy(sql`date_trunc('day', ${follows.createdAt})`);

  const byDate = new Map(rows.map((r) => [r.date, r.count]));
  const points: FollowerGrowthPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    points.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return points;
}

export interface TopPost {
  id: string;
  body: string;
  createdAt: Date;
  likeCount: number;
  commentCount: number;
}

export async function getTopPosts(userId: string, limit = 5): Promise<TopPost[]> {
  return db
    .select({
      id: posts.id,
      body: posts.body,
      createdAt: posts.createdAt,
      likeCount: sql<number>`count(distinct ${postReactions.userId})`.mapWith(Number),
      commentCount: sql<number>`count(distinct ${comments.id})`.mapWith(Number),
    })
    .from(posts)
    .leftJoin(postReactions, eq(postReactions.postId, posts.id))
    .leftJoin(comments, and(eq(comments.postId, posts.id), isNull(comments.deletedAt)))
    .where(and(eq(posts.authorId, userId), isNull(posts.deletedAt)))
    .groupBy(posts.id)
    .orderBy(desc(sql`count(distinct ${postReactions.userId}) + count(distinct ${comments.id})`))
    .limit(limit);
}

export interface EngagementSummary {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalFollowers: number;
}

export async function getEngagementSummary(userId: string): Promise<EngagementSummary> {
  const [[postRow], [likeRow], [commentRow], [followerRow]] = await Promise.all([
    db.select({ value: count() }).from(posts).where(and(eq(posts.authorId, userId), isNull(posts.deletedAt))),
    db
      .select({ value: count() })
      .from(postReactions)
      .innerJoin(posts, eq(posts.id, postReactions.postId))
      .where(eq(posts.authorId, userId)),
    db
      .select({ value: count() })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .where(and(eq(posts.authorId, userId), isNull(comments.deletedAt))),
    db.select({ value: count() }).from(follows).where(eq(follows.followingId, userId)),
  ]);

  return {
    totalPosts: postRow?.value ?? 0,
    totalLikes: likeRow?.value ?? 0,
    totalComments: commentRow?.value ?? 0,
    totalFollowers: followerRow?.value ?? 0,
  };
}

export interface FollowerExportRow {
  username: string;
  displayName: string;
  followedAt: Date;
}

/** Ownership is the caller's responsibility — pass the requesting user's own id. */
export async function getFollowersForExport(userId: string): Promise<FollowerExportRow[]> {
  return db
    .select({ username: profiles.username, displayName: profiles.displayName, followedAt: follows.createdAt })
    .from(follows)
    .innerJoin(profiles, eq(profiles.userId, follows.followerId))
    .where(eq(follows.followingId, userId))
    .orderBy(desc(follows.createdAt));
}
