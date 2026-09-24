"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";

const createCommentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first.").max(1000, "Comments are capped at 1000 characters."),
  parentCommentId: z.string().uuid().optional(),
});

export async function createComment(input: z.infer<typeof createCommentSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to comment.");

  const parsed = createCommentSchema.parse(input);

  await db.insert(comments).values({
    postId: parsed.postId,
    authorId: session.userId,
    body: parsed.body,
    parentCommentId: parsed.parentCommentId,
  });

  revalidatePath(`/post/${parsed.postId}`);
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
