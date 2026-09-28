"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Sparkles, Send, Check, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSelectionFormatting } from "@/lib/hooks/use-selection-formatting";
import { useMagicPencilPaste } from "@/lib/hooks/use-magic-pencil-paste";
import { SelectionToolbar } from "@/components/post/selection-toolbar";
import { ComposerReplyBanner, type ComposerReplyTarget } from "@/components/messages/composer-reply-banner";
import { ComposerEditBanner } from "@/components/messages/composer-edit-banner";
import { uploadImage } from "@/lib/upload-client";
import { toast } from "sonner";

const MAX_LENGTH = 2000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface ComposerEditTarget {
  id: string;
  body: string;
}

export interface PendingAttachment {
  url: string;
  width: number;
  height: number;
  publicId: string;
}

export interface ComposerBaseProps<TMessage> {
  onSend: (body: string, replyTarget: ComposerReplyTarget | null, attachment: PendingAttachment | null) => Promise<TMessage>;
  onSent: (message: TMessage, tempId?: string) => void;
  onOptimisticSend?: (tempId: string, body: string, replyTarget: ComposerReplyTarget | null, attachment: PendingAttachment | null) => void;
  onSendError?: (tempId: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  replyTarget?: ComposerReplyTarget | null;
  onCancelReply?: () => void;
  editTarget?: ComposerEditTarget | null;
  onEditSubmit?: (messageId: string, body: string) => Promise<void>;
  onCancelEdit?: () => void;
  extraActions?: React.ReactNode;
}

export function ComposerBase<TMessage>({
  onSend,
  onSent,
  onOptimisticSend,
  onSendError,
  disabled,
  disabledReason,
  replyTarget,
  onCancelReply,
  editTarget,
  onEditSubmit,
  onCancelEdit,
  extraActions,
}: ComposerBaseProps<TMessage>) {
  const [body, setBody] = useState("");
  const [syncedEditId, setSyncedEditId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { anchor, close: closeToolbar, wrapSelection, clearFormatting } = useSelectionFormatting(textareaRef, setBody);
  const magicPencil = useMagicPencilPaste(textareaRef, setBody);

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported for now.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Images must be under 8MB.");
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadImage(file, "messages");
      setAttachment(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  // Loads the target's text into the draft exactly once per edit target
  // (render-phase state adjustment, not an effect — this is genuinely
  // deriving `body` from the `editTarget` prop, not reacting to an
  // external system) — a fresh keystroke afterward is what should own `body`.
  if (editTarget && editTarget.id !== syncedEditId) {
    setSyncedEditId(editTarget.id);
    setBody(editTarget.body);
  } else if (!editTarget && syncedEditId !== null) {
    // Clears the "already synced" marker on cancel/save so re-editing the
    // same message later re-syncs its (possibly now-stale) text — and clears
    // the draft itself, so the loaded message text doesn't linger as a
    // regular draft when the edit is cancelled (e.g. via the banner's X, or
    // by starting a reply to a different message mid-edit).
    setSyncedEditId(null);
    setBody("");
  }

  useEffect(() => {
    if (editTarget) textareaRef.current?.focus();
  }, [editTarget]);

  function handleSubmit() {
    const trimmed = body.trim();

    if (editTarget && onEditSubmit) {
      if (!trimmed) return;
      startTransition(async () => {
        try {
          await onEditSubmit(editTarget.id, trimmed);
          setBody("");
          onCancelEdit?.();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Couldn't save that edit.");
        }
      });
      return;
    }

    // A caption-less image is a valid send (WhatsApp/Telegram-style) — only
    // reject when there's neither text nor an attached image.
    if (!trimmed && !attachment) return;

    const target = replyTarget ?? null;
    const sentAttachment = attachment;
    // Only generated when the caller wants optimistic UI, so the tempId
    // threads through onSent/onSendError for that caller and is undefined
    // (a no-op) for callers that don't.
    const tempId = onOptimisticSend ? crypto.randomUUID() : undefined;
    if (tempId) onOptimisticSend?.(tempId, trimmed, target, sentAttachment);
    startTransition(async () => {
      try {
        const message = await onSend(trimmed, target, sentAttachment);
        // Only clear the draft once the send is confirmed — on failure
        // (rate limit, request-cap, network blip) the typed text, reply
        // target, and attachment stay put so the user can retry without redoing them.
        setBody("");
        setAttachment(null);
        onCancelReply?.();
        onSent(message, tempId);
      } catch (error) {
        if (tempId) onSendError?.(tempId);
        toast.error(error instanceof Error ? error.message : "Couldn't send your message.");
      }
    });
  }

  if (disabled) {
    return <div className="text-muted-foreground border-t px-4 py-3 text-center text-sm">{disabledReason}</div>;
  }

  return (
    <div className="border-t">
      {editTarget && onCancelEdit ? (
        <ComposerEditBanner onCancel={onCancelEdit} />
      ) : (
        replyTarget && onCancelReply && <ComposerReplyBanner target={replyTarget} onCancel={onCancelReply} />
      )}
      {attachment && !editTarget && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border">
            <Image src={attachment.url} alt="" fill className="object-cover" />
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove image"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
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
              if (e.key === "Escape" && editTarget) {
                setBody("");
                onCancelEdit?.();
              }
            }}
            placeholder="Message…"
            rows={1}
            className="min-h-9 resize-none border-none px-0 shadow-none focus-visible:ring-0"
          />
          <SelectionToolbar anchor={anchor} onClose={closeToolbar} wrapSelection={wrapSelection} clearFormatting={clearFormatting} />
        </div>
        {!editTarget && (
          <>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploading || Boolean(attachment)}
              aria-label="Attach an image"
              title="Attach an image"
            >
              {isUploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            </Button>
          </>
        )}
        {/* Poll/contact-share dialogs post standalone messages with no
            replyToMessageId support — hidden during a reply so creating one
            can't silently leave the pending reply banner attached to
            whatever's typed next instead. */}
        {!editTarget && !replyTarget && extraActions}
        {!editTarget && magicPencil.active && (
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
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={isPending || isUploading || (!body.trim() && !attachment)}
          aria-label={editTarget ? "Save edit" : "Send"}
        >
          {editTarget ? <Check className="size-4" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
