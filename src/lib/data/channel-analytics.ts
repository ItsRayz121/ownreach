import "server-only";
import { and, count, desc, eq, gte, inArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { channelMessages, channelMessageViews, channels, communities, communityDepartures, communityMembers } from "@/db/schema";
import { cached } from "@/lib/cache";

export type ChannelAnalyticsRange = "1d" | "7d" | "30d" | "3m" | "12m" | "all";

export const CHANNEL_ANALYTICS_RANGES: { value: ChannelAnalyticsRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "3m", label: "3M" },
  { value: "12m", label: "12M" },
  { value: "all", label: "All time" },
];

export function parseChannelAnalyticsRange(value: string | undefined): ChannelAnalyticsRange {
  return CHANNEL_ANALYTICS_RANGES.some((r) => r.value === value) ? (value as ChannelAnalyticsRange) : "30d";
}

export type AnalyticsGranularity = "hour" | "day" | "week" | "month";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Start of the bucket containing `d`, in UTC — mirrors Postgres date_trunc (weeks start on Monday). */
function truncate(d: Date, granularity: AnalyticsGranularity): Date {
  const t = new Date(d);
  t.setUTCMinutes(0, 0, 0);
  if (granularity === "hour") return t;
  t.setUTCHours(0);
  if (granularity === "day") return t;
  if (granularity === "week") {
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
    return t;
  }
  t.setUTCDate(1);
  return t;
}

function addBucket(d: Date, granularity: AnalyticsGranularity, n: number): Date {
  const t = new Date(d);
  if (granularity === "hour") t.setTime(t.getTime() + n * HOUR_MS);
  else if (granularity === "day") t.setUTCDate(t.getUTCDate() + n);
  else if (granularity === "week") t.setUTCDate(t.getUTCDate() + 7 * n);
  else t.setUTCMonth(t.getUTCMonth() + n);
  return t;
}

/** The window and bucket size for a range. "All" starts at the channel's creation. */
function planRange(
  range: ChannelAnalyticsRange,
  createdAt: Date,
  now: Date
): { since: Date; granularity: AnalyticsGranularity; buckets: number } {
  const fixed = (granularity: AnalyticsGranularity, buckets: number) => ({
    since: addBucket(truncate(now, granularity), granularity, -(buckets - 1)),
    granularity,
    buckets,
  });
  if (range === "1d") return fixed("hour", 24);
  if (range === "7d") return fixed("day", 7);
  if (range === "30d") return fixed("day", 30);
  if (range === "3m") return fixed("week", 13);
  if (range === "12m") return fixed("month", 12);

  const ageDays = (now.getTime() - createdAt.getTime()) / DAY_MS;
  const granularity: AnalyticsGranularity = ageDays <= 2 ? "hour" : ageDays <= 90 ? "day" : ageDays <= 730 ? "week" : "month";
  const since = truncate(createdAt, granularity);
  let buckets = 1;
  while (addBucket(since, granularity, buckets) <= now) buckets++;
  return { since, granularity, buckets };
}

export interface ChannelAnalyticsPoint {
  /** Bucket start, ISO in UTC without a zone suffix (e.g. "2026-09-30T00:00:00"). */
  date: string;
  views: number;
  joins: number;
  leaves: number;
  net: number;
}

export interface TopChannelPost {
  id: string;
  body: string;
  createdAt: Date;
  views: number;
}

export interface ChannelAnalytics {
  range: ChannelAnalyticsRange;
  granularity: AnalyticsGranularity;
  totalMembers: number;
  /** Lifetime views across every post in the channel. */
  totalViews: number;
  viewsInPeriod: number;
  joins: number;
  leaves: number;
  netGrowth: number;
  postsInPeriod: number;
  /** Views received in the period per post published in it; null when nothing was posted. */
  avgViewsPerPost: number | null;
  /** Posts published in the period, most viewed first. */
  topPosts: TopChannelPost[];
  points: ChannelAnalyticsPoint[];
}

/** Role checks are the caller's responsibility. */
async function computeChannelAnalytics(communityId: string, range: ChannelAnalyticsRange): Promise<ChannelAnalytics> {
  const now = new Date();
  const [community] = await db.select({ createdAt: communities.createdAt }).from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) throw new Error("Community not found.");

  const { since, granularity, buckets } = planRange(range, community.createdAt, now);
  // sql.raw for the granularity: it is one of our own fixed literals, and a
  // bound parameter would make date_trunc() in SELECT and GROUP BY look like
  // different expressions to Postgres (same reasoning as data/analytics.ts).
  const bucketOf = (column: AnyColumn) => sql`date_trunc(${sql.raw(`'${granularity}'`)}, ${column})`;
  const bucketKey = (expr: SQL) => sql<string>`to_char(${expr}, 'YYYY-MM-DD"T"HH24:00:00')`;

  const channelIds = db.select({ id: channels.id }).from(channels).where(eq(channels.communityId, communityId));
  const postIds = db.select({ id: channelMessages.id }).from(channelMessages).where(inArray(channelMessages.channelId, channelIds));

  const viewBucket = bucketOf(channelMessageViews.createdAt);
  const memberJoinBucket = bucketOf(communityMembers.joinedAt);
  const departedJoinBucket = bucketOf(communityDepartures.joinedAt);
  const leaveBucket = bucketOf(communityDepartures.leftAt);

  const [viewRows, memberJoinRows, departedJoinRows, leaveRows, [memberRow], [totalViewsRow], [postsRow], topRows] = await Promise.all([
    db
      .select({ bucket: bucketKey(viewBucket), value: count() })
      .from(channelMessageViews)
      .where(and(inArray(channelMessageViews.messageId, postIds), gte(channelMessageViews.createdAt, since)))
      .groupBy(viewBucket),
    db
      .select({ bucket: bucketKey(memberJoinBucket), value: count() })
      .from(communityMembers)
      .where(and(eq(communityMembers.communityId, communityId), gte(communityMembers.joinedAt, since)))
      .groupBy(memberJoinBucket),
    db
      .select({ bucket: bucketKey(departedJoinBucket), value: count() })
      .from(communityDepartures)
      .where(and(eq(communityDepartures.communityId, communityId), gte(communityDepartures.joinedAt, since)))
      .groupBy(departedJoinBucket),
    db
      .select({ bucket: bucketKey(leaveBucket), value: count() })
      .from(communityDepartures)
      .where(and(eq(communityDepartures.communityId, communityId), gte(communityDepartures.leftAt, since)))
      .groupBy(leaveBucket),
    db.select({ value: count() }).from(communityMembers).where(eq(communityMembers.communityId, communityId)),
    db.select({ value: count() }).from(channelMessageViews).where(inArray(channelMessageViews.messageId, postIds)),
    db
      .select({ value: count() })
      .from(channelMessages)
      .where(and(inArray(channelMessages.channelId, channelIds), gte(channelMessages.createdAt, since))),
    db
      .select({
        id: channelMessages.id,
        body: channelMessages.body,
        createdAt: channelMessages.createdAt,
        views: sql<number>`count(${channelMessageViews.userId})`.mapWith(Number),
      })
      .from(channelMessages)
      .leftJoin(channelMessageViews, eq(channelMessageViews.messageId, channelMessages.id))
      .where(and(inArray(channelMessages.channelId, channelIds), gte(channelMessages.createdAt, since)))
      .groupBy(channelMessages.id)
      .orderBy(desc(sql`count(${channelMessageViews.userId})`), desc(channelMessages.createdAt))
      .limit(5),
  ]);

  const sumInto = (map: Map<string, number>, rows: { bucket: string; value: number }[]) => {
    for (const r of rows) map.set(r.bucket, (map.get(r.bucket) ?? 0) + r.value);
  };
  const views = new Map<string, number>();
  const joins = new Map<string, number>();
  const leaves = new Map<string, number>();
  sumInto(views, viewRows);
  sumInto(joins, memberJoinRows);
  sumInto(joins, departedJoinRows);
  sumInto(leaves, leaveRows);

  const points: ChannelAnalyticsPoint[] = [];
  for (let i = 0; i < buckets; i++) {
    const date = addBucket(since, granularity, i).toISOString().slice(0, 13) + ":00:00";
    const j = joins.get(date) ?? 0;
    const l = leaves.get(date) ?? 0;
    points.push({ date, views: views.get(date) ?? 0, joins: j, leaves: l, net: j - l });
  }

  const sum = (pick: (p: ChannelAnalyticsPoint) => number) => points.reduce((total, p) => total + pick(p), 0);
  const viewsInPeriod = sum((p) => p.views);
  const joinsInPeriod = sum((p) => p.joins);
  const leavesInPeriod = sum((p) => p.leaves);
  const postsInPeriod = postsRow?.value ?? 0;

  return {
    range,
    granularity,
    totalMembers: memberRow?.value ?? 0,
    totalViews: totalViewsRow?.value ?? 0,
    viewsInPeriod,
    joins: joinsInPeriod,
    leaves: leavesInPeriod,
    netGrowth: joinsInPeriod - leavesInPeriod,
    postsInPeriod,
    avgViewsPerPost: postsInPeriod > 0 ? Math.round((viewsInPeriod / postsInPeriod) * 10) / 10 : null,
    topPosts: topRows.map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt, views: r.views })),
    points,
  };
}

const CACHE_TTL_SECONDS = 60;

export async function getChannelAnalytics(communityId: string, range: ChannelAnalyticsRange): Promise<ChannelAnalytics> {
  return cached(`ownreach:analytics:channel:${communityId}:${range}`, CACHE_TTL_SECONDS, () => computeChannelAnalytics(communityId, range));
}
