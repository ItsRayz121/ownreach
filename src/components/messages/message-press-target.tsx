"use client";

import { useEffect, useRef } from "react";
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

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

// Wraps a message bubble so a tap or a long-press opens the message menu. On
// touch screens the bubble text is not selectable (and the OS callout is
// suppressed), so a long-press shows only OwnReach's own menu instead of
// competing with Android's Copy / Select all toolbar; Copy lives in the menu.
// A right-click opens it on desktop, where text stays selectable with the
// mouse. A tap that lands while text is selected just dismisses the selection.
// A hover-only "…" button covers desktop and keyboard users.
export function MessagePressTarget({ onOpenMenu, mine, disabled, className, children }: MessagePressTargetProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);

  function cancelPress() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }

  useEffect(() => cancelPress, []);

  function isInteractive(target: EventTarget | null) {
    return Boolean((target as HTMLElement | null)?.closest?.(INTERACTIVE_SELECTOR));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    longPressed.current = false;
    if (disabled || e.pointerType === "mouse" || isInteractive(e.target)) return;
    start.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      timer.current = null;
      longPressed.current = true;
      navigator.vibrate?.(10);
      onOpenMenu();
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancelPress();
  }

  function handleContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    if (isInteractive(e.target)) return;
    e.preventDefault();
    if (disabled || longPressed.current) return; // the long-press timer already opened the menu
    onOpenMenu();
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (disabled || isInteractive(e.target)) return;
    if (window.getSelection()?.toString()) return;
    onOpenMenu();
  }

  return (
    <div className={cn("group/press relative", className)}>
      <div
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={handleContextMenu}
        className="[-webkit-touch-callout:none] pointer-coarse:select-none"
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
