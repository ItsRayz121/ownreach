"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { posts, postMedia, postReactions, bookmarks, hashtags, postHashtags, notifications, profiles } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { publishToChannel } from "@/lib/realtime/ably-server";

const createPostSchema = z.object({
  body: z.string().trim().min(1, "Say something first.").max(2000, "Posts are capped at 2000 characters."),
  mediaUrl: z
    .string()
    .url()
    .refine((url) => new URL(url).hostname === "res.cloudinary.com", "Media must be uploaded through Cloudinary.")
    .optional(),
  mediaWidth: z.number().int().positive().optional(),
  mediaHeight: z.number().int().positive().optional(),
});

function extractHashtags(body: string) {
  const matches = body.match(/#[a-zA-Z0-9_]{2,50}/g) ?? [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

function extractMentions(body: string) {
  const matches = body.match(/@[a-zA-Z0-9_]{2,30}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

export async function createPost(input: z.infer<typeof createPostSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to post.");
  await checkRateLimit("post:create", session.userId, { limit: 10, window: "10 m" });

  const parsed = createPostSchema.parse(input);
  const tags = extractHashtags(parsed.body);

  const { postId, mentionRecipientIds } = await db.transaction(async (tx) => {
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

    const mentionedUsernames = extractMentions(parsed.body);
    let mentionRecipientIds: string[] = [];
    if (mentionedUsernames.length > 0) {
      const mentioned = await tx
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(inArray(profiles.username, mentionedUsernames));
      mentionRecipientIds = mentioned.map((m) => m.userId).filter((id) => id !== session.userId);
      if (mentionRecipientIds.length > 0) {
        await tx.insert(notifications).values(
          mentionRecipientIds.map((recipientId) => ({
            recipientId,
            actorId: session.userId,
            type: "mention" as const,
            postId: post.id,
          }))
        );
      }
    }

    return { postId: post.id, mentionRecipientIds };
  });

  await Promise.all(
    mentionRecipientIds.map((recipientId) => publishToChannel(`user:${recipientId}:notifications`, "new", { type: "mention" }))
  );

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
  await checkRateLimit("post:like", session.userId, { limit: 60, window: "10 m" });

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

  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (post && post.authorId !== session.userId) {
    await db.insert(notifications).values({
      recipientId: post.authorId,
      actorId: session.userId,
      type: "like",
      postId,
    });
    await publishToChannel(`user:${post.authorId}:notifications`, "new", { type: "like" });
  }

  return { liked: true };
}

export async function toggleBookmark(postId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to bookmark.");
  await checkRateLimit("post:bookmark", session.userId, { limit: 60, window: "10 m" });

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
