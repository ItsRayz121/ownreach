import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { follows } from "@/db/schema";

export async function isFollowing(followerId: string, followingId: string) {
  const [row] = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);
  return Boolean(row);
}
