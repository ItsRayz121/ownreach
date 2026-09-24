import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { comments, profiles } from "@/db/schema";

export interface CommentWithAuthor {
  id: string;
  body: string;
  createdAt: Date;
  parentCommentId: string | null;
  author: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export async function getCommentsForPost(postId: string): Promise<CommentWithAuthor[]> {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      parentCommentId: comments.parentCommentId,
      author: {
        userId: profiles.userId,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
      },
    })
    .from(comments)
    .innerJoin(profiles, eq(profiles.userId, comments.authorId))
    .where(and(eq(comments.postId, postId), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt));
}
