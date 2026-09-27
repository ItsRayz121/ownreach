import "server-only";
import { and, asc, eq, ilike, ne, notInArray, or, count } from "drizzle-orm";
import { db } from "@/db";
import { profiles, profileSocialLinks, follows, posts, users } from "@/db/schema";
import { escapeLikePattern } from "./communities";
import { rankBySimilarity } from "@/lib/text-similarity";

const SEARCH_PAGE_SIZE = 20;
const SUGGESTION_CANDIDATE_LIMIT = 300;
const SUGGESTION_COUNT = 5;

export interface ProfileSearchResult {
  matches: (typeof profiles.$inferSelect)[];
  /** "Did you mean" fallback, ranked by edit-distance similarity — populated only when `matches` is thin. */
  suggestions: (typeof profiles.$inferSelect)[];
}

export async function searchProfiles(query: string, opts: { excludeUserId?: string } = {}): Promise<ProfileSearchResult> {
  const pattern = `%${escapeLikePattern(query)}%`;
  const matches = await db
    .select()
    .from(profiles)
    .where(
      and(
        or(ilike(profiles.username, pattern), ilike(profiles.displayName, pattern)),
        opts.excludeUserId ? ne(profiles.userId, opts.excludeUserId) : undefined
      )
    )
    .limit(SEARCH_PAGE_SIZE);

  if (matches.length >= SEARCH_PAGE_SIZE || query.trim().length === 0) {
    return { matches, suggestions: [] };
  }

  // Broader candidate pool for a "Did you mean" fallback, ranked by
  // edit-distance similarity in JS rather than a DB extension (e.g.
  // pg_trgm) — keeps this portable across Postgres hosts. Deliberately not
  // prefix-filtered: a typo in the first character(s) — the most common kind
  // — would otherwise exclude the very candidate we're trying to suggest.
  // Bounded to SUGGESTION_CANDIDATE_LIMIT rows, acceptable at this app's
  // current scale (see the "personal-inbox-sized" note on listConversations).
  const excludeIds = matches.map((m) => m.userId);
  const candidates = await db
    .select()
    .from(profiles)
    .where(
      and(
        excludeIds.length ? notInArray(profiles.userId, excludeIds) : undefined,
        opts.excludeUserId ? ne(profiles.userId, opts.excludeUserId) : undefined
      )
    )
    .limit(SUGGESTION_CANDIDATE_LIMIT);

  const ranked = rankBySimilarity(query, candidates, (p) => p.username).slice(0, SUGGESTION_COUNT);
  return { matches, suggestions: ranked };
}

export async function getProfileByUsername(username: string) {
  const [row] = await db
    .select({
      userId: profiles.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      bio: profiles.bio,
      avatarUrl: profiles.avatarUrl,
      coverUrl: profiles.coverUrl,
      location: profiles.location,
      website: profiles.website,
      isCreator: profiles.isCreator,
      creatorCategory: profiles.creatorCategory,
      createdAt: profiles.createdAt,
      role: users.role,
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(profiles.username, username))
    .limit(1);

  return row ?? null;
}

export async function getProfileCounts(userId: string) {
  const [[followers], [following], [postCount]] = await Promise.all([
    db.select({ value: count() }).from(follows).where(eq(follows.followingId, userId)),
    db.select({ value: count() }).from(follows).where(eq(follows.followerId, userId)),
    db.select({ value: count() }).from(posts).where(eq(posts.authorId, userId)),
  ]);

  return {
    followers: followers?.value ?? 0,
    following: following?.value ?? 0,
    posts: postCount?.value ?? 0,
  };
}

export async function getProfileByUserId(userId: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return row ?? null;
}

export async function getSocialLinks(userId: string) {
  return db
    .select({
      id: profileSocialLinks.id,
      platform: profileSocialLinks.platform,
      label: profileSocialLinks.label,
      url: profileSocialLinks.url,
    })
    .from(profileSocialLinks)
    .where(eq(profileSocialLinks.userId, userId))
    .orderBy(asc(profileSocialLinks.position), asc(profileSocialLinks.createdAt));
}
