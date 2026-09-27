"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendChannelMessage } from "@/lib/actions/communities";
import { useSelectionFormatting } from "@/lib/hooks/use-selection-formatting";
import { useMagicPencilPaste } from "@/lib/hooks/use-magic-pencil-paste";
import { SelectionToolbar } from "@/components/post/selection-toolbar";
import { ComposerReplyBanner, type ComposerReplyTarget } from "@/components/messages/composer-reply-banner";
import type { ChannelMessageItem } from "@/lib/data/communities";
import { toast } from "sonner";

const MAX_LENGTH = 2000;

interface ChannelComposerProps {
  channelId: string;
  onSent: (message: ChannelMessageItem) => void;
  replyTarget?: ComposerReplyTarget | null;
  onCancelReply?: () => void;
}

export function ChannelComposer({ channelId, onSent, replyTarget, onCancelReply }: ChannelComposerProps) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { anchor, close: closeToolbar, wrapSelection, clearFormatting } = useSelectionFormatting(textareaRef, setBody);
  const magicPencil = useMagicPencilPaste(textareaRef, setBody);

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const message = await sendChannelMessage({
          channelId,
          body: trimmed,
          replyToMessageId: replyTarget?.messageId,
          replyExcerpt: replyTarget?.excerpt,
        });
        setBody("");
        onCancelReply?.();
        onSent(message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't send your message.");
      }
    });
  }

  return (
    <div className="border-t">
      {replyTarget && onCancelReply && <ComposerReplyBanner target={replyTarget} onCancel={onCancelReply} />}
      <div className="flex items-end gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              magicPencil.notifyEdited();
              setBody(e.target.value.slice(0, MAX_LENGTH));
            }}
            onPaste={magicPencil.handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Message…"
            rows={1}
            className="min-h-9 resize-none border-none px-0 shadow-none focus-visible:ring-0"
          />
          <SelectionToolbar anchor={anchor} onClose={closeToolbar} wrapSelection={wrapSelection} clearFormatting={clearFormatting} />
        </div>
        {magicPencil.active && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={magicPencil.apply}
            aria-label="Magic pencil — restore original formatting"
            title="Magic pencil — restore original formatting"
          >
            <Sparkles className="size-4" />
          </Button>
        )}
        <Button size="icon" onClick={handleSubmit} disabled={isPending || !body.trim()} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
