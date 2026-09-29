"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

// A bottom-anchored sheet on phones that becomes a small centered card from
// `md` up. Built on the same base-ui Dialog as ui/sheet.tsx and ui/dialog.tsx
// (focus trap, scroll lock, Escape/outside-tap dismissal come from there) —
// it exists because neither of those adapts between the two placements.

function BottomSheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="bottom-sheet" {...props} />;
}

// iOS Safari doesn't shrink the layout viewport when the keyboard opens, so a
// `bottom-0` sheet would sit underneath it. Lifting the sheet by the keyboard's
// height (read from the visual viewport) keeps a search field inside it usable.
function useKeyboardInset() {
  const [keyboard, setKeyboard] = useState({ inset: 0, visibleHeight: 0 });

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function update() {
      if (!viewport) return;
      setKeyboard({ inset: Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop), visibleHeight: viewport.height });
    }

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return keyboard;
}

function BottomSheetContent({ className, children, title, style, ...props }: SheetPrimitive.Popup.Props & { title: string }) {
  const { inset, visibleHeight } = useKeyboardInset();

  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <SheetPrimitive.Popup
        data-slot="bottom-sheet-content"
        className={cn(
          "bg-popover text-popover-foreground fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg outline-none",
          "transition duration-200 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full",
          "md:inset-0 md:m-auto md:h-fit md:w-80 md:rounded-2xl md:border md:pb-2 md:data-ending-style:translate-y-0 md:data-ending-style:scale-95 md:data-ending-style:opacity-0 md:data-starting-style:translate-y-0 md:data-starting-style:scale-95 md:data-starting-style:opacity-0",
          className
        )}
        style={inset > 0 ? { ...(typeof style === "object" ? style : null), bottom: inset, maxHeight: visibleHeight * 0.92 } : style}
        {...props}
      >
        <div aria-hidden className="bg-muted-foreground/30 mx-auto mt-2 h-1 w-9 shrink-0 rounded-full md:hidden" />
        <SheetPrimitive.Title className="sr-only">{title}</SheetPrimitive.Title>
        {children}
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

export { BottomSheet, BottomSheetContent };
