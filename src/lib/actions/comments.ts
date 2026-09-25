"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, posts, profiles } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { insertNotifications, scheduleNotificationPublish } from "@/lib/actions/notify";

const createCommentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first.").max(1000, "Comments are capped at 1000 characters."),
  parentCommentId: z.string().uuid().optional(),
});

function extractMentions(body: string) {
  const matches = body.match(/@[a-zA-Z0-9_]{2,30}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

export async function createComment(input: z.infer<typeof createCommentSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to comment.");
  await checkRateLimit("comment:create", session.userId, { limit: 30, window: "10 m" });

  const parsed = createCommentSchema.parse(input);

  const { commentId, notified } = await db.transaction(async (tx) => {
    const [comment] = await tx
      .insert(comments)
      .values({
        postId: parsed.postId,
        authorId: session.userId,
        body: parsed.body,
        parentCommentId: parsed.parentCommentId,
      })
      .returning({ id: comments.id });

    const [post] = await tx.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, parsed.postId)).limit(1);

    const recipientIds = new Set<string>();
    const notified: { recipientId: string; type: "comment" | "mention" }[] = [];
    if (post && post.authorId !== session.userId) {
      recipientIds.add(post.authorId);
      notified.push({ recipientId: post.authorId, type: "comment" });
      await insertNotifications(tx, [
        { recipientId: post.authorId, actorId: session.userId, type: "comment", postId: parsed.postId, commentId: comment.id },
      ]);
    }

    const mentionedUsernames = extractMentions(parsed.body);
    if (mentionedUsernames.length > 0) {
      const mentioned = await tx
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(inArray(profiles.username, mentionedUsernames));
      const mentionRecipients = mentioned
        .map((m) => m.userId)
        .filter((id) => id !== session.userId && !recipientIds.has(id));
      if (mentionRecipients.length > 0) {
        for (const recipientId of mentionRecipients) notified.push({ recipientId, type: "mention" });
        await insertNotifications(
          tx,
          mentionRecipients.map((recipientId) => ({
            recipientId,
            actorId: session.userId,
            type: "mention" as const,
            postId: parsed.postId,
            commentId: comment.id,
          }))
        );
      }
    }

    return { commentId: comment.id, notified };
  });

  scheduleNotificationPublish(notified);

  revalidatePath(`/post/${parsed.postId}`);
  return { id: commentId };
}

export async function deleteComment(commentId: string, postId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const [comment] = await db.select({ authorId: comments.authorId }).from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!comment) throw new Error("Comment not found.");
  if (comment.authorId !== session.userId && session.role !== "admin") {
    throw new Error("You can only delete your own comments.");
  }

  await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));
  revalidatePath(`/post/${postId}`);
}
