import "server-only";
import { and, count, desc, eq, ilike, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { communities, communityMembers, channels, channelMessages, profiles, type CommunityMember } from "@/db/schema";

const DISCOVER_PAGE_SIZE = 30;
const CHANNEL_MESSAGE_PAGE_SIZE = 50;

export interface CommunitySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  visibility: "public" | "private";
  memberCount: number;
  role: CommunityMember["role"] | null;
  createdAt: Date;
}

export interface ChannelSummary {
  id: string;
  name: string;
  description: string | null;
  position: number;
}

export interface ChannelMessageItem {
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

function encodeCursor(row: { createdAt: Date; id: string }) {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString("base64url");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `%`/`_` are SQL LIKE wildcards, not literal characters — without escaping,
// searching for e.g. "100% Club" would match every community name instead of
// filtering, since the `%` is interpreted as "any characters" either side of it.
function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function withMemberCounts(rows: { id: string }[]): Promise<Map<string, number>> {
  if (rows.length === 0) return new Map();
  const counts = await db
    .select({ communityId: communityMembers.communityId, value: count() })
    .from(communityMembers)
    .where(inArray(communityMembers.communityId, rows.map((r) => r.id)))
    .groupBy(communityMembers.communityId);
  return new Map(counts.map((c) => [c.communityId, c.value]));
}

/** A user's communities, sorted by most recently joined. Not cursor-paginated — personal-sized list, like listConversations. */
export async function listMyCommunities(userId: string): Promise<CommunitySummary[]> {
  const rows = await db
    .select({
      id: communities.id,
      slug: communities.slug,
      name: communities.name,
      description: communities.description,
      avatarUrl: communities.avatarUrl,
      visibility: communities.visibility,
      createdAt: communities.createdAt,
      role: communityMembers.role,
      joinedAt: communityMembers.joinedAt,
    })
    .from(communityMembers)
    .innerJoin(communities, eq(communities.id, communityMembers.communityId))
    .where(eq(communityMembers.userId, userId))
    .orderBy(desc(communityMembers.joinedAt));

  const memberCounts = await withMemberCounts(rows);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    avatarUrl: r.avatarUrl,
    visibility: r.visibility,
    memberCount: memberCounts.get(r.id) ?? 0,
    role: r.role,
    createdAt: r.createdAt,
  }));
}

/** Public community browse/search — cursor-paginated since, unlike listMyCommunities, this is an unbounded public surface. */
export async function listDiscoverableCommunities(opts: {
  query?: string;
  viewerId?: string;
  cursor?: string;
}): Promise<{ items: CommunitySummary[]; nextCursor: string | null }> {
  const decoded = decodeCursor(opts.cursor);
  const cursorFilter = decoded
    ? or(
        lt(communities.createdAt, decoded.createdAt),
        and(eq(communities.createdAt, decoded.createdAt), lt(communities.id, decoded.id))
      )
    : undefined;

  const rows = await db
    .select({
      id: communities.id,
      slug: communities.slug,
      name: communities.name,
      description: communities.description,
      avatarUrl: communities.avatarUrl,
      visibility: communities.visibility,
      createdAt: communities.createdAt,
    })
    .from(communities)
    .where(
      and(
        eq(communities.visibility, "public"),
        opts.query ? ilike(communities.name, `%${escapeLikePattern(opts.query)}%`) : undefined,
        cursorFilter
      )
    )
    .orderBy(desc(communities.createdAt), desc(communities.id))
    .limit(DISCOVER_PAGE_SIZE);

  const [memberCounts, myRoles] = await Promise.all([
    withMemberCounts(rows),
    opts.viewerId
      ? db
          .select({ communityId: communityMembers.communityId, role: communityMembers.role })
          .from(communityMembers)
          .where(and(eq(communityMembers.userId, opts.viewerId), inArray(communityMembers.communityId, rows.map((r) => r.id))))
      : Promise.resolve([]),
  ]);
  const roleMap = new Map(myRoles.map((r) => [r.communityId, r.role]));

  const last = rows.at(-1);
  const nextCursor = rows.length === DISCOVER_PAGE_SIZE && last ? encodeCursor(last) : null;

  return {
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      avatarUrl: r.avatarUrl,
      visibility: r.visibility,
      memberCount: memberCounts.get(r.id) ?? 0,
      role: roleMap.get(r.id) ?? null,
      createdAt: r.createdAt,
    })),
    nextCursor,
  };
}

export async function getCommunityBySlugOrId(slugOrId: string) {
  const [row] = await db
    .select()
    .from(communities)
    .where(UUID_RE.test(slugOrId) ? eq(communities.id, slugOrId) : eq(communities.slug, slugOrId))
    .limit(1);
  return row ?? null;
}

/** Owner and admin are both "manager" roles for UI/permission purposes — kept in one place so a future role addition can't drift between call sites. */
export function isCommunityManager(role: CommunityMember["role"] | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export async function getMembership(communityId: string, userId: string): Promise<CommunityMember | null> {
  const [row] = await db
    .select()
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listChannels(communityId: string): Promise<ChannelSummary[]> {
  return db
    .select({ id: channels.id, name: channels.name, description: channels.description, position: channels.position })
    .from(channels)
    .where(eq(channels.communityId, communityId))
    .orderBy(channels.position, channels.createdAt);
}

export async function getChannel(channelId: string) {
  const [row] = await db
    .select({ id: channels.id, communityId: channels.communityId, name: channels.name, description: channels.description })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);
  return row ?? null;
}

/** Returns messages in ascending (oldest-first) order; `cursor` pages backward for older history. */
export async function listChannelMessages(
  channelId: string,
  cursor?: string
): Promise<{ items: ChannelMessageItem[]; nextCursor: string | null }> {
  const decoded = decodeCursor(cursor);
  const cursorFilter = decoded
    ? or(
        lt(channelMessages.createdAt, decoded.createdAt),
        and(eq(channelMessages.createdAt, decoded.createdAt), lt(channelMessages.id, decoded.id))
      )
    : undefined;

  const rows = await db
    .select({ id: channelMessages.id, body: channelMessages.body, createdAt: channelMessages.createdAt, senderId: channelMessages.senderId })
    .from(channelMessages)
    .where(and(eq(channelMessages.channelId, channelId), cursorFilter))
    .orderBy(desc(channelMessages.createdAt), desc(channelMessages.id))
    .limit(CHANNEL_MESSAGE_PAGE_SIZE);

  const last = rows.at(-1);
  const nextCursor = rows.length === CHANNEL_MESSAGE_PAGE_SIZE && last ? encodeCursor(last) : null;
  return { items: rows.reverse(), nextCursor };
}

export async function listMembers(communityId: string) {
  return db
    .select({
      userId: profiles.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      role: communityMembers.role,
      joinedAt: communityMembers.joinedAt,
    })
    .from(communityMembers)
    .innerJoin(profiles, eq(profiles.userId, communityMembers.userId))
    .where(eq(communityMembers.communityId, communityId))
    .orderBy(communityMembers.joinedAt);
}

/** For the Ably token route: every channel id across every community this user is a member of. */
export async function listChannelIdsForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ channelId: channels.id })
    .from(communityMembers)
    .innerJoin(channels, eq(channels.communityId, communityMembers.communityId))
    .where(eq(communityMembers.userId, userId));
  return rows.map((r) => r.channelId);
}
