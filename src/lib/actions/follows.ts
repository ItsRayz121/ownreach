"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { follows, notifications } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { isFollowing } from "@/lib/data/follows";
import { checkRateLimit } from "@/lib/ratelimit";
import { publishToChannel } from "@/lib/realtime/ably-server";

export async function toggleFollow(targetUserId: string, targetUsername: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to follow creators.");
  if (session.userId === targetUserId) throw new Error("You can't follow yourself.");
  await checkRateLimit("follow:toggle", session.userId, { limit: 30, window: "10 m" });

  const alreadyFollowing = await isFollowing(session.userId, targetUserId);

  if (alreadyFollowing) {
    await db
      .delete(follows)
      .where(and(eq(follows.followerId, session.userId), eq(follows.followingId, targetUserId)));
  } else {
    // Relies on the (follower_id, following_id) primary key to reject a
    // duplicate row outright if two requests race. Only the request whose
    // insert actually lands (the `returning` row is non-empty) notifies —
    // otherwise a race would double-notify the target for one logical follow.
    const inserted = await db
      .insert(follows)
      .values({ followerId: session.userId, followingId: targetUserId })
      .onConflictDoNothing()
      .returning({ followerId: follows.followerId });

    if (inserted.length > 0) {
      await db.insert(notifications).values({
        recipientId: targetUserId,
        actorId: session.userId,
        type: "follow",
      });
      await publishToChannel(`user:${targetUserId}:notifications`, "new", { type: "follow" });
    }
  }

  revalidatePath(`/${targetUsername}`);
  return { following: !alreadyFollowing };
}
