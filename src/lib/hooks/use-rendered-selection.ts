"use client";

import { useCallback, useEffect, useState } from "react";

export interface RenderedSelectionAnchor {
  getBoundingClientRect: () => DOMRect;
}

function closestMessageId(node: Node | null): string | null {
  let el: HTMLElement | null = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  while (el) {
    if (el.dataset.messageId) return el.dataset.messageId;
    el = el.parentElement;
  }
  return null;
}

/**
 * Tracks a text selection made inside `containerRef` (a rendered message
 * list, not a textarea — so this reads the native Selection/Range API
 * directly instead of the mirror-div technique `useSelectionFormatting`
 * needs for textareas). Used to power "quote selected text".
 */
export function useRenderedSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [anchor, setAnchor] = useState<RenderedSelectionAnchor | null>(null);
  const [text, setText] = useState("");
  const [messageId, setMessageId] = useState<string | null>(null);

  const clear = useCallback(() => {
    setAnchor(null);
    setText("");
    setMessageId(null);
  }, []);

  const update = useCallback(() => {
    const container = containerRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      clear();
      return;
    }
    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      clear();
      return;
    }
    const selectedText = selection.toString().trim();
    const msgId = closestMessageId(range.commonAncestorContainer);
    if (!selectedText || !msgId) {
      clear();
      return;
    }
    const rect = range.getBoundingClientRect();
    setAnchor({ getBoundingClientRect: () => rect });
    setText(selectedText);
    setMessageId(msgId);
  }, [containerRef, clear]);

  useEffect(() => {
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [update]);

  const dismiss = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    clear();
  }, [clear]);

  return { anchor, text, messageId, dismiss };
}
