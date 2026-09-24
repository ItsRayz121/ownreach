import Link from "next/link";
import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { ReactionBar } from "./reaction-bar";
import { RichText } from "./rich-text";
import { formatRelativeTime } from "@/lib/format";
import type { FeedPost } from "@/lib/data/posts";

interface PostCardProps {
  post: FeedPost;
  isAuthenticated: boolean;
  /** Renders as a static block instead of a link-to-detail wrapper — used on the post detail page itself. */
  isDetail?: boolean;
}

export function PostCard({ post, isAuthenticated, isDetail }: PostCardProps) {
  const body = (
    <div className="flex gap-3 px-4 py-3.5">
      <Link href={`/${post.author.username}`} className="shrink-0">
        <UserAvatar src={post.author.avatarUrl} name={post.author.displayName} className="size-10" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-sm">
          <Link href={`/${post.author.username}`} className="truncate font-semibold hover:underline">
            {post.author.displayName}
          </Link>
          {post.author.isCreator && <BadgeCheck className="text-primary size-4 shrink-0" aria-label="Creator" />}
          <Link href={`/${post.author.username}`} className="text-muted-foreground truncate">
            @{post.author.username}
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href={`/post/${post.id}`} className="text-muted-foreground shrink-0 hover:underline">
            {formatRelativeTime(post.createdAt)}
          </Link>
        </div>

        <div className="mt-0.5 text-[15px] leading-relaxed whitespace-pre-wrap wrap-break-word">
          <RichText text={post.body} />
          {post.edited && <span className="text-muted-foreground ml-1 text-xs">(edited)</span>}
        </div>

        {post.media.length > 0 && (
          <div className="border-border/60 mt-3 overflow-hidden rounded-xl border">
            {post.media.map((m) => (
              <Image
                key={m.id}
                src={m.url}
                alt={m.altText ?? ""}
                width={m.width ?? 1200}
                height={m.height ?? 800}
                className="h-auto w-full object-cover"
                sizes="(max-width: 640px) 100vw, 600px"
              />
            ))}
          </div>
        )}

        <div className="mt-3">
          <ReactionBar
            postId={post.id}
            likeCount={post.likeCount}
            commentCount={post.commentCount}
            likedByViewer={post.likedByViewer}
            bookmarkedByViewer={post.bookmarkedByViewer}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </div>
    </div>
  );

  if (isDetail) {
    return <article className="border-b">{body}</article>;
  }

  return <article className="hover:bg-accent/30 border-b transition-colors">{body}</article>;
}
