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
  wrapSelection: (before: string, after?: string, selectSuffix?: boolean) => void;
  clearFormatting: () => void;
  magicPencil?: MagicPencilState;
  /**
   * "popover" floats over the selection. "bar" is a fixed row the caller places
   * itself: always rendered, with the buttons disabled while nothing is selected.
   */
  variant?: "popover" | "bar";
}

// Format actions for text selected in a composer. As a popover it is layered
// on top of any static toolbar; as a bar it sits in a fixed spot instead, so
// it can't collide with the native Android/iOS selection menu (Cut / Copy /
// Paste / Select all), which floats above the selected text.
export function SelectionToolbar({ anchor, onClose, wrapSelection, clearFormatting, magicPencil, variant = "popover" }: SelectionToolbarProps) {
  if (variant === "bar") {
    return (
      <div role="toolbar" aria-label="Text formatting" className="flex items-center justify-around gap-0.5 border-t px-2 py-1">
        <FormatButtons wrapSelection={wrapSelection} clearFormatting={clearFormatting} disabled={anchor === null} />
      </div>
    );
  }

  return (
    <Popover open={anchor !== null} onOpenChange={(open) => !open && onClose()}>
      <PopoverPortal>
        <PopoverPositioner anchor={anchor} side="top" sideOffset={8}>
          <PopoverPopup className="flex items-center gap-0.5 p-1" initialFocus={false} finalFocus={false}>
            <FormatButtons wrapSelection={wrapSelection} clearFormatting={clearFormatting} />
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

function FormatButtons({
  wrapSelection,
  clearFormatting,
  disabled,
}: Pick<SelectionToolbarProps, "wrapSelection" | "clearFormatting"> & { disabled?: boolean }) {
  return (
    <>
      <ToolbarButton label="Bold" disabled={disabled} onClick={() => wrapSelection("**")}>
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" disabled={disabled} onClick={() => wrapSelection("*")}>
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Underline" disabled={disabled} onClick={() => wrapSelection("__")}>
        <Underline className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" disabled={disabled} onClick={() => wrapSelection("~~")}>
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Code" disabled={disabled} onClick={() => wrapSelection("`")}>
        <Code className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Create link" disabled={disabled} onClick={() => wrapSelection("[", "](https://)", true)}>
        <Link2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton label="Regular (clear formatting)" disabled={disabled} onClick={clearFormatting}>
        <RemoveFormatting className="size-4" />
      </ToolbarButton>
    </>
  );
}

function ToolbarButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      // Prevent the textarea from losing focus/selection when a toolbar button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
