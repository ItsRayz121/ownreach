"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendMessage } from "@/lib/actions/messages";
import { useSelectionFormatting } from "@/lib/hooks/use-selection-formatting";
import { useMagicPencilPaste } from "@/lib/hooks/use-magic-pencil-paste";
import { SelectionToolbar } from "@/components/post/selection-toolbar";
import type { MessageItem } from "@/lib/data/messages";
import { toast } from "sonner";

const MAX_LENGTH = 2000;

interface MessageComposerProps {
  conversationId: string;
  onSent: (message: MessageItem) => void;
}

export function MessageComposer({ conversationId, onSent }: MessageComposerProps) {
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
        const message = await sendMessage({ conversationId, body: trimmed });
        setBody("");
        onSent(message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't send your message.");
      }
    });
  }

  return (
    <div className="flex items-end gap-2 border-t px-3 py-2.5">
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
  );
}
