"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { createComment } from "@/lib/actions/comments";
import { useSelectionFormatting } from "@/lib/hooks/use-selection-formatting";
import { useMagicPencilPaste } from "@/lib/hooks/use-magic-pencil-paste";
import { SelectionToolbar } from "@/components/post/selection-toolbar";
import { toast } from "sonner";

interface CommentComposerProps {
  postId: string;
  displayName: string;
  avatarUrl?: string | null;
}

export function CommentComposer({ postId, displayName, avatarUrl }: CommentComposerProps) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { anchor, close: closeToolbar, wrapSelection, clearFormatting } = useSelectionFormatting(textareaRef, setBody);
  const magicPencil = useMagicPencilPaste(textareaRef, setBody);

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
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            magicPencil.notifyEdited();
            setBody(e.target.value.slice(0, 1000));
          }}
          onPaste={magicPencil.handlePaste}
          placeholder="Reply"
          rows={1}
          className="min-h-9 resize-none border-none px-0 shadow-none focus-visible:ring-0"
        />
        <SelectionToolbar anchor={anchor} onClose={closeToolbar} wrapSelection={wrapSelection} clearFormatting={clearFormatting} />
        {magicPencil.active && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={magicPencil.apply}
            aria-label="Magic pencil — restore original formatting"
            title="Magic pencil — restore original formatting"
          >
            <Sparkles className="size-4" />
          </Button>
        )}
        <Button size="sm" onClick={handleSubmit} disabled={isPending || !body.trim()}>
          Reply
        </Button>
      </div>
    </div>
  );
}
