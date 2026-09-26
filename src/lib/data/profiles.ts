import "server-only";
import { and, eq, ilike, ne, or, count } from "drizzle-orm";
import { db } from "@/db";
import { profiles, follows, posts, users } from "@/db/schema";
import { escapeLikePattern } from "./communities";

const SEARCH_PAGE_SIZE = 20;

export async function searchProfiles(query: string, opts: { excludeUserId?: string } = {}) {
  const pattern = `%${escapeLikePattern(query)}%`;
  return db
    .select()
    .from(profiles)
    .where(
      and(
        or(ilike(profiles.username, pattern), ilike(profiles.displayName, pattern)),
        opts.excludeUserId ? ne(profiles.userId, opts.excludeUserId) : undefined
      )
    )
    .limit(SEARCH_PAGE_SIZE);
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
