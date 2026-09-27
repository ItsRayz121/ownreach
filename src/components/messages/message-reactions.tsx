"use client";

import { useRef, useState } from "react";
import { SmilePlus } from "lucide-react";
import { Popover, PopoverPortal, PopoverPositioner, PopoverPopup } from "@/components/ui/popover";
import { MESSAGE_REACTION_EMOJIS } from "@/lib/reactions";
import { cn } from "@/lib/utils";

interface ReactionEntry {
  emoji: string;
  userId: string;
}

interface MessageReactionsProps {
  reactions: ReactionEntry[];
  viewerId: string;
  onToggle: (emoji: string) => void;
  mine?: boolean;
}

// A row of grouped reaction pills plus a picker for the fixed emoji set —
// shared between DM, group, and channel message bubbles.
export function MessageReactions({ reactions, viewerId, onToggle, mine }: MessageReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const grouped = new Map<string, string[]>();
  for (const r of reactions) {
    const list = grouped.get(r.emoji) ?? [];
    list.push(r.userId);
    grouped.set(r.emoji, list);
  }

  return (
    <div className={cn("mt-1 flex flex-wrap items-center gap-1", mine ? "justify-end" : "justify-start")}>
      {[...grouped.entries()].map(([emoji, userIds]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
            userIds.includes(viewerId) ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent/60"
          )}
        >
          <span>{emoji}</span>
          <span className="text-muted-foreground">{userIds.length}</span>
        </button>
      ))}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setPickerOpen((o) => !o)}
        aria-label="Add reaction"
        title="Add reaction"
        className="text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-full p-1"
      >
        <SmilePlus className="size-3.5" />
      </button>

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverPortal>
          <PopoverPositioner anchor={triggerRef} side="top" sideOffset={6}>
            <PopoverPopup className="flex items-center gap-0.5 p-1">
              {MESSAGE_REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onToggle(emoji);
                    setPickerOpen(false);
                  }}
                  className="hover:bg-accent/60 rounded-md p-1.5 text-base leading-none"
                >
                  {emoji}
                </button>
              ))}
            </PopoverPopup>
          </PopoverPositioner>
        </PopoverPortal>
      </Popover>
    </div>
  );
}
