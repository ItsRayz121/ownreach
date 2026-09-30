"use client";

import { MoreHorizontal } from "lucide-react";
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

// Anything inside a message that already does something when tapped (links,
// reaction chips, poll options, delete-photo…) keeps doing it instead of
// opening the menu.
const INTERACTIVE_SELECTOR = "a, button, input, textarea, select, summary, [role='button'], [data-no-message-menu]";

// Wraps a message bubble so a single tap opens the message menu. Long-press is
// left to the browser so text can be selected with the native handles; a tap
// that lands while text is selected just dismisses the selection. A hover-only
// "…" button covers desktop and keyboard users.
export function MessagePressTarget({ onOpenMenu, mine, disabled, className, children }: MessagePressTargetProps) {
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    if (window.getSelection()?.toString()) return;
    onOpenMenu();
  }

  return (
    <div className={cn("group/press relative", className)}>
      <div onClick={handleClick}>{children}</div>
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
