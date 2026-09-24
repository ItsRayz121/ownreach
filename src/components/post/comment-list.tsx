import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { RichText } from "./rich-text";
import { formatRelativeTime } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { MessageCircle } from "lucide-react";
import type { CommentWithAuthor } from "@/lib/data/comments";

export function CommentList({ comments }: { comments: CommentWithAuthor[] }) {
  if (comments.length === 0) {
    return <EmptyState icon={MessageCircle} title="No replies yet" description="Be the first to say something." />;
  }

  return (
    <ul>
      {comments.map((comment) => (
        <li key={comment.id} className="flex gap-3 border-b px-4 py-3">
          <Link href={`/${comment.author.username}`} className="shrink-0">
            <UserAvatar src={comment.author.avatarUrl} name={comment.author.displayName} className="size-8" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm">
              <Link href={`/${comment.author.username}`} className="truncate font-semibold hover:underline">
                {comment.author.displayName}
              </Link>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
            </div>
            <div className="mt-0.5 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
              <RichText text={comment.body} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
