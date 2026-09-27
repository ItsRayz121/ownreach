import "server-only";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, follows, posts, postReactions, profiles } from "@/db/schema";
import { cached } from "@/lib/cache";

// No view-tracking exists on the main feed, so these are scoped to what's
// derivable from existing tables: follower growth, per-post engagement, and
// simple totals. (Channel posts get their own view count — see
// lib/data/communities.ts — which is a separate, broadcast-only surface.)

export type AnalyticsRange = "24h" | "7d" | "30d" | "1y";

const RANGE_CONFIG: Record<AnalyticsRange, { granularity: "hour" | "day" | "month"; buckets: number }> = {
  "24h": { granularity: "hour", buckets: 24 },
  "7d": { granularity: "day", buckets: 7 },
  "30d": { granularity: "day", buckets: 30 },
  "1y": { granularity: "month", buckets: 12 },
};

// Month buckets step via setUTCMonth instead (calendar months vary in length).
const STEP_MS: Record<"hour" | "day", number> = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

function rangeSince(range: AnalyticsRange): Date {
  const { granularity, buckets } = RANGE_CONFIG[range];
  const since = new Date();
  if (granularity === "month") {
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(1);
    since.setUTCMonth(since.getUTCMonth() - (buckets - 1));
  } else if (granularity === "day") {
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (buckets - 1));
  } else {
    since.setUTCMinutes(0, 0, 0);
    since.setUTCHours(since.getUTCHours() - (buckets - 1));
  }
  return since;
}

export interface FollowerGrowthPoint {
  date: string; // bucket label — ISO date (day/month ranges) or ISO hour (24h range)
  count: number;
}

/** One row per bucket in the range, including zero-count buckets. */
async function computeFollowerGrowth(userId: string, range: AnalyticsRange): Promise<FollowerGrowthPoint[]> {
  const { granularity, buckets } = RANGE_CONFIG[range];
  const since = rangeSince(range);

  // sql.raw, not a bound param: date_trunc($1, x) in SELECT and date_trunc($2, x)
  // in GROUP BY bind to the same value but are different parameterized
  // expressions, so Postgres's grouping-column check (syntactic, not
  // value-based) rejects them as mismatched. granularity is our own fixed
  // "hour"|"day"|"month", never user input, so raw interpolation is safe.
  const truncated = sql`date_trunc(${sql.raw(`'${granularity}'`)}, ${follows.createdAt})`;
  const rows = await db
    .select({
      bucket: sql<string>`to_char(${truncated}, 'YYYY-MM-DD"T"HH24:00:00')`,
      count: count(),
    })
    .from(follows)
    .where(and(eq(follows.followingId, userId), gte(follows.createdAt, since)))
    .groupBy(truncated)
    .orderBy(truncated);

  const byBucket = new Map(rows.map((r) => [r.bucket, r.count]));
  const points: FollowerGrowthPoint[] = [];
  for (let i = 0; i < buckets; i++) {
    const d = new Date(since);
    if (granularity === "month") d.setUTCMonth(d.getUTCMonth() + i);
    else d.setTime(d.getTime() + i * STEP_MS[granularity]);
    const key = d.toISOString().slice(0, 13) + ":00:00";
    points.push({ date: key, count: byBucket.get(key) ?? 0 });
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

async function computeTopPosts(userId: string, limit: number, range: AnalyticsRange): Promise<TopPost[]> {
  const since = rangeSince(range);
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
    .where(and(eq(posts.authorId, userId), isNull(posts.deletedAt), gte(posts.createdAt, since)))
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

async function computeEngagementSummary(userId: string, range: AnalyticsRange): Promise<EngagementSummary> {
  const since = rangeSince(range);
  const [[postRow], [likeRow], [commentRow], [followerRow]] = await Promise.all([
    db.select({ value: count() }).from(posts).where(and(eq(posts.authorId, userId), isNull(posts.deletedAt), gte(posts.createdAt, since))),
    db
      .select({ value: count() })
      .from(postReactions)
      .innerJoin(posts, eq(posts.id, postReactions.postId))
      .where(and(eq(posts.authorId, userId), gte(postReactions.createdAt, since))),
    db
      .select({ value: count() })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .where(and(eq(posts.authorId, userId), isNull(comments.deletedAt), gte(comments.createdAt, since))),
    db.select({ value: count() }).from(follows).where(and(eq(follows.followingId, userId), gte(follows.createdAt, since))),
  ]);

  return {
    totalPosts: postRow?.value ?? 0,
    totalLikes: likeRow?.value ?? 0,
    totalComments: commentRow?.value ?? 0,
    totalFollowers: followerRow?.value ?? 0,
  };
}

const CACHE_TTL_SECONDS = 5 * 60;

export async function getFollowerGrowth(userId: string, range: AnalyticsRange): Promise<FollowerGrowthPoint[]> {
  return cached(`ownreach:analytics:growth:${userId}:${range}`, CACHE_TTL_SECONDS, () => computeFollowerGrowth(userId, range));
}

export async function getTopPosts(userId: string, limit: number, range: AnalyticsRange): Promise<TopPost[]> {
  return cached(`ownreach:analytics:top-posts:${userId}:${range}:${limit}`, CACHE_TTL_SECONDS, () =>
    computeTopPosts(userId, limit, range)
  );
}

export async function getEngagementSummary(userId: string, range: AnalyticsRange): Promise<EngagementSummary> {
  return cached(`ownreach:analytics:summary:${userId}:${range}`, CACHE_TTL_SECONDS, () =>
    computeEngagementSummary(userId, range)
  );
}

export interface FollowerExportRow {
  username: string;
  displayName: string;
  followedAt: Date;
}

const MAX_FOLLOWER_EXPORT_ROWS = 50_000;

/** Ownership is the caller's responsibility — pass the requesting user's own id. */
export async function getFollowersForExport(userId: string): Promise<FollowerExportRow[]> {
  return db
    .select({ username: profiles.username, displayName: profiles.displayName, followedAt: follows.createdAt })
    .from(follows)
    .innerJoin(profiles, eq(profiles.userId, follows.followerId))
    .where(eq(follows.followingId, userId))
    .orderBy(desc(follows.createdAt))
    .limit(MAX_FOLLOWER_EXPORT_ROWS);
}
