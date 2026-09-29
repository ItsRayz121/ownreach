"use client";

import { MoreHorizontal } from "lucide-react";
import { useLongPress } from "@/lib/hooks/use-long-press";
import { cn } from "@/lib/utils";

interface MessagePressTargetProps {
  onOpenMenu: () => void;
  /** Own messages sit on the right, so the desktop menu button goes on their left (and vice versa). */
  mine: boolean;
  /** Not-yet-sent messages have no real id to act on. */
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

// Wraps a message bubble so it opens the message menu on long-press (touch)
// or right-click, with a hover-only "…" button on desktop for people who
// don't know to right-click. Nothing is drawn permanently under the message.
export function MessagePressTarget({ onOpenMenu, mine, disabled, className, children }: MessagePressTargetProps) {
  const press = useLongPress(onOpenMenu);

  return (
    <div className={cn("group/press relative", className)}>
      <div
        {...(disabled ? {} : press)}
        // Long-press shouldn't select text or pop the OS link/image callout on
        // touch screens — the menu's Copy replaces both. Mouse selection is
        // left alone so desktop users can still highlight and quote.
        className="[@media(pointer:coarse)]:select-none"
        style={{ WebkitTouchCallout: "none" }}
      >
        {children}
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Message actions"
          className={cn(
            "text-muted-foreground hover:bg-accent/60 hover:text-foreground absolute top-1/2 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/press:opacity-100 focus-visible:opacity-100 md:flex",
            mine ? "right-full mr-1" : "left-full ml-1"
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      )}
    </div>
  );
}
