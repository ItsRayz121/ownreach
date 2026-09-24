"use client";

import { useCallback, useRef, useState } from "react";
import { htmlToMarkup, unicodeStyledToMarkup } from "@/lib/format/normalize-pasted-text";

interface PendingConversion {
  start: number;
  end: number;
  /** The plain text the browser actually inserted — used to detect a stale/edited range before applying. */
  plain: string;
  markup: string;
}

export interface UseMagicPencilPasteResult {
  /** True right after a paste that carried detectable foreign formatting. */
  active: boolean;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  /** Call from the textarea's onChange for any edit that isn't the tracked paste itself. */
  notifyEdited: () => void;
  apply: () => void;
}

/**
 * Lets the default (plain-text) paste happen as normal, but remembers
 * whether the clipboard also carried real formatting (HTML tags or Unicode
 * "fancy text" characters) so the composer can offer to restore it via the
 * magic-pencil button, instead of silently rewriting what the user pasted.
 */
export function useMagicPencilPaste(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  onChange: (next: string) => void
): UseMagicPencilPasteResult {
  const [pending, setPending] = useState<PendingConversion | null>(null);
  const justPastedRef = useRef(false);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const html = e.clipboardData.getData("text/html");
      const plain = e.clipboardData.getData("text/plain");
      justPastedRef.current = true;

      if (!plain) {
        setPending(null);
        return;
      }

      const htmlResult = html ? htmlToMarkup(html) : null;
      const unicodeResult = unicodeStyledToMarkup(plain);
      const markup = htmlResult?.hasFormatting ? htmlResult.markup : unicodeResult.hasStyledRuns ? unicodeResult.markup : null;

      if (!markup) {
        setPending(null);
        return;
      }

      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      setPending({ start, end: start + plain.length, plain, markup });
    },
    [textareaRef]
  );

  const notifyEdited = useCallback(() => {
    if (justPastedRef.current) {
      justPastedRef.current = false;
      return;
    }
    setPending(null);
  }, []);

  const apply = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !pending) return;
    const current = el.value;
    if (current.slice(pending.start, pending.end) !== pending.plain) {
      // The user edited around the pasted text since — bail rather than corrupt content.
      setPending(null);
      return;
    }
    const next = current.slice(0, pending.start) + pending.markup + current.slice(pending.end);
    onChange(next);
    const caret = pending.start + pending.markup.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
    setPending(null);
  }, [textareaRef, onChange, pending]);

  return { active: pending !== null, handlePaste, notifyEdited, apply };
}
