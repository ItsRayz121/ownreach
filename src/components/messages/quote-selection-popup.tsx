"use client";

import { Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPortal, PopoverPositioner, PopoverPopup } from "@/components/ui/popover";
import { useRenderedSelection } from "@/lib/hooks/use-rendered-selection";

interface QuoteSelectionPopupProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onQuote: (messageId: string, excerpt: string) => void;
}

// Floating "Quote" button that appears when the viewer selects text inside a
// rendered message bubble — lets them quote just the highlighted part rather
// than the whole message (see the per-message "Reply" affordance for that).
export function QuoteSelectionPopup({ containerRef, onQuote }: QuoteSelectionPopupProps) {
  const { anchor, text, messageId, dismiss } = useRenderedSelection(containerRef);

  return (
    <Popover open={anchor !== null} onOpenChange={(open) => !open && dismiss()}>
      <PopoverPortal>
        <PopoverPositioner anchor={anchor} side="top" sideOffset={8}>
          <PopoverPopup initialFocus={false} finalFocus={false}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (messageId && text) onQuote(messageId, text.slice(0, 500));
                dismiss();
              }}
            >
              <Quote className="size-3.5" />
              Quote
            </Button>
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}
