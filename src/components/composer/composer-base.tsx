"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Sparkles, Send, Check, ImagePlus, Loader2, Plus, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BottomSheet, BottomSheetContent } from "@/components/ui/bottom-sheet";
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

/** One row in the composer's + menu (beyond the built-in Image row). */
export interface AttachMenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
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
  /** Extra rows for the + menu (poll, contact…). Hidden while replying — see below. */
  attachItems?: AttachMenuItem[];
  /** Dialogs those rows open; rendered outside the menu so they outlive it closing. */
  dialogs?: React.ReactNode;
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
  attachItems,
  dialogs,
}: ComposerBaseProps<TMessage>) {
  const [body, setBody] = useState("");
  const [syncedEditId, setSyncedEditId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  // Tapping "Reply" in the message menu should land the cursor in the input.
  const replyMessageId = replyTarget?.messageId;
  useEffect(() => {
    if (replyMessageId) textareaRef.current?.focus();
  }, [replyMessageId]);

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
    return <div className="text-muted-foreground shrink-0 border-t px-4 py-3 text-center text-sm">{disabledReason}</div>;
  }

  // Poll/contact-share post standalone messages with no replyToMessageId
  // support — hidden during a reply so creating one can't silently leave the
  // pending reply banner attached to whatever's typed next instead.
  const extraItems = replyTarget ? [] : (attachItems ?? []);
  const imageBlocked = isUploading || Boolean(attachment);

  return (
    <div className="bg-background shrink-0 border-t">
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
            className="text-muted-foreground hover:text-foreground hover:bg-accent/60 flex size-9 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {!editTarget && magicPencil.active && (
        <button
          type="button"
          onClick={magicPencil.apply}
          className="text-primary hover:bg-accent/40 flex w-full items-center gap-1.5 border-b px-4 py-2 text-xs font-medium"
        >
          <Sparkles className="size-3.5" />
          Restore original formatting
        </button>
      )}
      <div className="flex items-end gap-2 px-2 py-2">
        {!editTarget && (
          <>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground size-10 rounded-full"
              onClick={() => setMenuOpen(true)}
              aria-label="Add to message"
              aria-haspopup="dialog"
            >
              {isUploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-6" />}
            </Button>
          </>
        )}
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
              // Enter sends with a hardware keyboard; on a touch keyboard it
              // inserts a newline and the Send button sends, as in other
              // messaging apps. Never fires mid-IME-composition.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia("(pointer: coarse)").matches) {
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
            className="bg-muted/40 max-h-36 min-h-10 resize-none overflow-y-auto rounded-2xl px-3.5 py-2 leading-normal"
          />
          <SelectionToolbar anchor={anchor} onClose={closeToolbar} wrapSelection={wrapSelection} clearFormatting={clearFormatting} />
        </div>
        <Button
          className="size-10 rounded-full"
          onClick={handleSubmit}
          // Keeps the keyboard up (and focus in the field) when Send is tapped.
          onMouseDown={(e) => e.preventDefault()}
          disabled={isPending || isUploading || (!body.trim() && !attachment)}
          aria-label={editTarget ? "Save edit" : "Send"}
        >
          {editTarget ? <Check className="size-5" /> : <Send className="size-5" />}
        </Button>
      </div>

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen}>
        <BottomSheetContent title="Add to message">
          <div className="flex flex-col px-2 pt-2 pb-1">
            <AttachRow
              icon={ImagePlus}
              label="Image"
              disabled={imageBlocked}
              onClick={() => {
                // Opened synchronously from this tap so the browser still
                // treats the file dialog as user-initiated.
                imageInputRef.current?.click();
                setMenuOpen(false);
              }}
            />
            {extraItems.map((item) => (
              <AttachRow
                key={item.key}
                icon={item.icon}
                label={item.label}
                onClick={() => {
                  setMenuOpen(false);
                  item.onSelect();
                }}
              />
            ))}
          </div>
        </BottomSheetContent>
      </BottomSheet>
      {dialogs}
    </div>
  );
}

function AttachRow({ icon: Icon, label, onClick, disabled }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="hover:bg-accent/60 focus-visible:ring-ring flex h-14 items-center gap-3.5 rounded-lg px-3 text-left text-[15px] font-medium outline-none transition-colors focus-visible:ring-2 disabled:opacity-50"
    >
      <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      {label}
    </button>
  );
}
