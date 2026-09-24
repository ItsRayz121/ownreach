"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";
import { toggleLike, toggleBookmark } from "@/lib/actions/posts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReactionBarProps {
  postId: string;
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
  bookmarkedByViewer: boolean;
  isAuthenticated: boolean;
}

export function ReactionBar({
  postId,
  likeCount,
  commentCount,
  likedByViewer,
  bookmarkedByViewer,
  isAuthenticated,
}: ReactionBarProps) {
  const [isPending, startTransition] = useTransition();
  const [liked, setOptimisticLiked] = useOptimistic(likedByViewer);
  const [bookmarked, setOptimisticBookmarked] = useOptimistic(bookmarkedByViewer);
  const [count, setOptimisticCount] = useOptimistic(likeCount);

  function requireAuth() {
    if (!isAuthenticated) {
      toast.error("Sign in to do that.");
      return false;
    }
    return true;
  }

  function handleLike() {
    if (!requireAuth()) return;
    startTransition(async () => {
      setOptimisticLiked(!liked);
      setOptimisticCount(liked ? count - 1 : count + 1);
      try {
        await toggleLike(postId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't react to this post.");
      }
    });
  }

  function handleBookmark() {
    if (!requireAuth()) return;
    startTransition(async () => {
      setOptimisticBookmarked(!bookmarked);
      try {
        await toggleBookmark(postId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't bookmark this post.");
      }
    });
  }

  async function handleShare() {
    const url = `${window.location.origin}/post/${postId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied.");
  }

  return (
    <div className="text-muted-foreground flex items-center gap-5 text-sm">
      <button
        type="button"
        onClick={handleLike}
        disabled={isPending}
        className={cn("flex items-center gap-1.5 transition-colors hover:text-rose-500", liked && "text-rose-500")}
        aria-pressed={liked}
      >
        <Heart className="size-[18px]" fill={liked ? "currentColor" : "none"} />
        {count > 0 && count}
      </button>

      <Link href={`/post/${postId}`} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
        <MessageCircle className="size-[18px]" />
        {commentCount > 0 && commentCount}
      </Link>

      <button type="button" onClick={handleShare} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
        <Share2 className="size-[18px]" />
      </button>

      <button
        type="button"
        onClick={handleBookmark}
        disabled={isPending}
        className={cn("hover:text-foreground ml-auto flex items-center gap-1.5 transition-colors", bookmarked && "text-primary")}
        aria-pressed={bookmarked}
      >
        <Bookmark className="size-[18px]" fill={bookmarked ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
