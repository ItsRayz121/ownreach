"use client";

import { useState } from "react";
import { Copy, Pencil, Reply, Trash2 } from "lucide-react";
import { BottomSheet, BottomSheetContent } from "@/components/ui/bottom-sheet";
import { MESSAGE_REACTION_EMOJIS } from "@/lib/reactions";
import { cn } from "@/lib/utils";

export interface MessageActions {
  /** Emoji the viewer has already picked on this message, if any. */
  activeEmoji?: string | null;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

interface MessageActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: MessageActions;
}

// Context menu for a single message, opened by long-press (touch) or
// right-click / the hover button (desktop). Only the actions the caller
// passes are rendered, so permissions are decided by the thread, not here.
export function MessageActionsSheet({ open, onOpenChange, actions }: MessageActionsSheetProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { activeEmoji, onReact, onReply, onCopy, onEdit, onDelete } = actions;

  function close() {
    onOpenChange(false);
  }

  function run(action: () => void) {
    close();
    action();
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setConfirmingDelete(false);
      }}
    >
      <BottomSheetContent title="Message actions" initialFocus={(interaction) => interaction === "keyboard"}>
        {onReact && (
          <div className="flex items-center justify-around gap-1 px-3 pt-3 pb-2" role="group" aria-label="React">
            {MESSAGE_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React ${emoji}`}
                aria-pressed={activeEmoji === emoji}
                onClick={() => run(() => onReact(emoji))}
                className={cn(
                  "focus-visible:ring-ring flex size-11 items-center justify-center rounded-full text-2xl leading-none outline-none transition-transform focus-visible:ring-2 active:scale-90",
                  activeEmoji === emoji ? "bg-accent ring-primary ring-2" : "hover:bg-accent/60"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className={cn("flex flex-col px-2 pb-1", onReact && "border-t pt-1")}>
          {onReply && <ActionRow icon={Reply} label="Reply" onClick={() => run(onReply)} />}
          {onCopy && <ActionRow icon={Copy} label="Copy" onClick={() => run(onCopy)} />}
          {onEdit && <ActionRow icon={Pencil} label="Edit" onClick={() => run(onEdit)} />}
          {onDelete &&
            (confirmingDelete ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-destructive flex-1 text-sm font-medium">Delete for everyone?</span>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="hover:bg-accent/60 h-10 rounded-lg px-3 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => run(onDelete)}
                  className="bg-destructive h-10 text-white rounded-lg px-3 text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            ) : (
              <ActionRow icon={Trash2} label="Delete" destructive onClick={() => setConfirmingDelete(true)} />
            ))}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Reply;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover:bg-accent/60 focus-visible:ring-ring flex h-12 items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium outline-none transition-colors focus-visible:ring-2",
        destructive && "text-destructive"
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.9} />
      {label}
    </button>
  );
}
