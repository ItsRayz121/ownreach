"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { posts, postMedia, postReactions, bookmarks, hashtags, postHashtags } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";

const createPostSchema = z.object({
  body: z.string().trim().min(1, "Say something first.").max(2000, "Posts are capped at 2000 characters."),
  mediaUrl: z.string().url().optional(),
  mediaWidth: z.number().int().positive().optional(),
  mediaHeight: z.number().int().positive().optional(),
});

function extractHashtags(body: string) {
  const matches = body.match(/#[a-zA-Z0-9_]{2,50}/g) ?? [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

export async function createPost(input: z.infer<typeof createPostSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to post.");

  const parsed = createPostSchema.parse(input);
  const tags = extractHashtags(parsed.body);

  const postId = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(posts)
      .values({ authorId: session.userId, body: parsed.body })
      .returning({ id: posts.id });

    if (parsed.mediaUrl) {
      await tx.insert(postMedia).values({
        postId: post.id,
        url: parsed.mediaUrl,
        width: parsed.mediaWidth,
        height: parsed.mediaHeight,
      });
    }

    for (const tag of tags) {
      const [hashtag] = await tx
        .insert(hashtags)
        .values({ tag })
        .onConflictDoUpdate({ target: hashtags.tag, set: { tag } })
        .returning({ id: hashtags.id });
      await tx.insert(postHashtags).values({ postId: post.id, hashtagId: hashtag.id }).onConflictDoNothing();
    }

    return post.id;
  });

  revalidatePath("/home");
  return { id: postId };
}

export async function deletePost(postId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) throw new Error("Post not found.");
  if (post.authorId !== session.userId && session.role !== "admin") {
    throw new Error("You can only delete your own posts.");
  }

  await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, postId));
  revalidatePath("/home");
}

export async function toggleLike(postId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to react.");

  const [existing] = await db
    .select()
    .from(postReactions)
    .where(and(eq(postReactions.postId, postId), eq(postReactions.userId, session.userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(postReactions)
      .where(and(eq(postReactions.postId, postId), eq(postReactions.userId, session.userId)));
    return { liked: false };
  }

  await db.insert(postReactions).values({ postId, userId: session.userId }).onConflictDoNothing();
  return { liked: true };
}

export async function toggleBookmark(postId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to bookmark.");

  const [existing] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.postId, postId), eq(bookmarks.userId, session.userId)))
    .limit(1);

  if (existing) {
    await db.delete(bookmarks).where(and(eq(bookmarks.postId, postId), eq(bookmarks.userId, session.userId)));
    return { bookmarked: false };
  }

  await db.insert(bookmarks).values({ postId, userId: session.userId }).onConflictDoNothing();
  return { bookmarked: true };
}
