"use client";

import { Quote, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPortal, PopoverPositioner, PopoverPopup } from "@/components/ui/popover";
import { useRenderedSelection } from "@/lib/hooks/use-rendered-selection";

interface QuoteSelectionPopupProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onQuote: (messageId: string, excerpt: string) => void;
}

// Floating "Copy"/"Quote" buttons that appear when the viewer selects text
// inside a rendered message bubble — an in-app replacement for the native
// OS copy/share selection menu (suppressed via the container's
// onContextMenu and -webkit-touch-callout, see message/channel thread), so
// selecting text in the app surfaces only these actions.
export function QuoteSelectionPopup({ containerRef, onQuote }: QuoteSelectionPopupProps) {
  const { anchor, text, messageId, dismiss } = useRenderedSelection(containerRef);

  return (
    <Popover open={anchor !== null} onOpenChange={(open) => !open && dismiss()}>
      <PopoverPortal>
        <PopoverPositioner anchor={anchor} side="top" sideOffset={8}>
          <PopoverPopup initialFocus={false} finalFocus={false} className="flex items-center gap-0.5 p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onMouseDown={(e) => e.preventDefault()}
              onClick={async () => {
                try {
                  if (text) await navigator.clipboard.writeText(text);
                } catch {
                  toast.error("Couldn't copy that text.");
                }
                dismiss();
              }}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
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
