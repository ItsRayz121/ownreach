"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePost } from "@/lib/actions/posts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function PostActionsMenu({ postId, redirectTo }: { postId: string; redirectTo?: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deletePost(postId);
        toast.success("Post deleted.");
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't delete this post.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="text-muted-foreground hover:text-foreground -m-1.5 ml-auto shrink-0 rounded-full p-1.5 transition-colors"
        aria-label="Post actions"
        disabled={isPending}
      >
        <MoreHorizontal className="size-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 />
          Delete post
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
