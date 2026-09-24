"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { follows } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { isFollowing } from "@/lib/data/follows";

export async function toggleFollow(targetUserId: string, targetUsername: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to follow creators.");
  if (session.userId === targetUserId) throw new Error("You can't follow yourself.");

  const alreadyFollowing = await isFollowing(session.userId, targetUserId);

  if (alreadyFollowing) {
    await db
      .delete(follows)
      .where(and(eq(follows.followerId, session.userId), eq(follows.followingId, targetUserId)));
  } else {
    // Relies on the (follower_id, following_id) primary key to reject a
    // duplicate row outright if two requests race.
    await db
      .insert(follows)
      .values({ followerId: session.userId, followingId: targetUserId })
      .onConflictDoNothing();
  }

  revalidatePath(`/${targetUsername}`);
  return { following: !alreadyFollowing };
}
