"use client";

import type { ReactNode } from "react";
import { Bold, Italic, Underline, Strikethrough, Code, Link2, RemoveFormatting, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPortal, PopoverPositioner, PopoverPopup } from "@/components/ui/popover";
import type { SelectionAnchor } from "@/lib/hooks/use-selection-formatting";

interface MagicPencilState {
  active: boolean;
  onApply: () => void;
}

interface SelectionToolbarProps {
  anchor: SelectionAnchor | null;
  onClose: () => void;
  wrapSelection: (before: string, after?: string) => void;
  clearFormatting: () => void;
  magicPencil?: MagicPencilState;
}

// Floating format popup that appears when text is selected in a composer —
// layered on top of any static toolbar, not a replacement for it (touch
// selection doesn't always give a clean popup, so the static row stays the
// reliable fallback).
export function SelectionToolbar({ anchor, onClose, wrapSelection, clearFormatting, magicPencil }: SelectionToolbarProps) {
  return (
    <Popover open={anchor !== null} onOpenChange={(open) => !open && onClose()}>
      <PopoverPortal>
        <PopoverPositioner anchor={anchor} side="top" sideOffset={8}>
          <PopoverPopup className="flex items-center gap-0.5 p-1" initialFocus={false} finalFocus={false}>
            <ToolbarButton label="Bold" onClick={() => wrapSelection("**")}>
              <Bold className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="Italic" onClick={() => wrapSelection("*")}>
              <Italic className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="Underline" onClick={() => wrapSelection("__")}>
              <Underline className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="Strikethrough" onClick={() => wrapSelection("~~")}>
              <Strikethrough className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="Code" onClick={() => wrapSelection("`")}>
              <Code className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="Link" onClick={() => wrapSelection("[", "](https://)")}>
              <Link2 className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="Regular (clear formatting)" onClick={clearFormatting}>
              <RemoveFormatting className="size-4" />
            </ToolbarButton>
            {magicPencil?.active && (
              <>
                <div className="mx-0.5 h-5 w-px bg-border" />
                <ToolbarButton label="Magic pencil — restore original formatting" onClick={magicPencil.onApply}>
                  <Sparkles className="size-4" />
                </ToolbarButton>
              </>
            )}
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      // Prevent the textarea from losing focus/selection when a toolbar button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
