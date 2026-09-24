"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { createComment } from "@/lib/actions/comments";
import { toast } from "sonner";

interface CommentComposerProps {
  postId: string;
  displayName: string;
  avatarUrl?: string | null;
}

export function CommentComposer({ postId, displayName, avatarUrl }: CommentComposerProps) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!body.trim()) return;
    startTransition(async () => {
      try {
        await createComment({ postId, body });
        setBody("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't post your comment.");
      }
    });
  }

  return (
    <div className="flex gap-3 border-b px-4 py-3">
      <UserAvatar src={avatarUrl} name={displayName} className="size-8 shrink-0" />
      <div className="flex min-w-0 flex-1 items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 1000))}
          placeholder="Reply"
          rows={1}
          className="min-h-9 resize-none border-none px-0 shadow-none focus-visible:ring-0"
        />
        <Button size="sm" onClick={handleSubmit} disabled={isPending || !body.trim()}>
          Reply
        </Button>
      </div>
    </div>
  );
}
