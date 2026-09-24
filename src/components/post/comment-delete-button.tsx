"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteComment } from "@/lib/actions/comments";

export function CommentDeleteButton({ commentId, postId }: { commentId: string; postId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteComment(commentId, postId);
        toast.success("Comment deleted.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't delete this comment.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="text-muted-foreground hover:text-destructive ml-auto shrink-0 transition-colors"
      aria-label="Delete comment"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
