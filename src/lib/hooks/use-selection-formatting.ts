"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ClientRectLike {
  x: number;
  y: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface SelectionAnchor {
  getBoundingClientRect: () => ClientRectLike;
}

export interface UseSelectionFormattingResult {
  /** Virtual anchor for a floating popover, or null when there's no active selection. */
  anchor: SelectionAnchor | null;
  close: () => void;
  wrapSelection: (before: string, after?: string) => void;
  clearFormatting: () => void;
}

// Textareas don't expose a selection bounding rect the way contentEditable
// does, so this mirrors the textarea's text box into a hidden, off-screen
// div with matching layout-affecting styles, drops zero-width marker spans
// at the selection boundaries, and reads their offsetLeft/offsetTop back —
// the classic "mirror div" caret-position technique.
function syncMirrorStyle(mirror: HTMLDivElement, computed: CSSStyleDeclaration) {
  mirror.style.boxSizing = computed.boxSizing;
  mirror.style.width = computed.width;
  mirror.style.paddingTop = computed.paddingTop;
  mirror.style.paddingRight = computed.paddingRight;
  mirror.style.paddingBottom = computed.paddingBottom;
  mirror.style.paddingLeft = computed.paddingLeft;
  mirror.style.borderTopWidth = computed.borderTopWidth;
  mirror.style.borderRightWidth = computed.borderRightWidth;
  mirror.style.borderBottomWidth = computed.borderBottomWidth;
  mirror.style.borderLeftWidth = computed.borderLeftWidth;
  mirror.style.borderStyle = "solid";
  mirror.style.borderColor = "transparent";
  mirror.style.fontFamily = computed.fontFamily;
  mirror.style.fontSize = computed.fontSize;
  mirror.style.fontWeight = computed.fontWeight;
  mirror.style.fontStyle = computed.fontStyle;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.textTransform = computed.textTransform;
  mirror.style.wordSpacing = computed.wordSpacing;
  mirror.style.tabSize = computed.tabSize;
  mirror.style.textIndent = computed.textIndent;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflowWrap = "break-word";
}

const STRIP_FORMATTING_RE: RegExp[] = [
  /\*\*([^*\n]+)\*\*/g,
  /\*([^*\n]+)\*/g,
  /__([^_\n]+)__/g,
  /~~([^~\n]+)~~/g,
  /`([^`\n]+)`/g,
  /\[([^\]\n]+)\]\([^)\n]+\)/g,
];

function stripFormatting(selected: string): string {
  return STRIP_FORMATTING_RE.reduce((text, re) => text.replace(re, "$1"), selected);
}

export function useSelectionFormatting(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  onChange: (next: string) => void
): UseSelectionFormattingResult {
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);

  const getMirror = useCallback(() => {
    if (mirrorRef.current) return mirrorRef.current;
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.top = "0";
    div.style.left = "-9999px";
    div.style.overflow = "hidden";
    document.body.appendChild(div);
    mirrorRef.current = div;
    return div;
  }, []);

  useEffect(
    () => () => {
      mirrorRef.current?.remove();
      mirrorRef.current = null;
    },
    []
  );

  const updateSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el || document.activeElement !== el) {
      setAnchor(null);
      return;
    }
    const { selectionStart, selectionEnd } = el;
    if (selectionStart === selectionEnd) {
      setAnchor(null);
      return;
    }

    const mirror = getMirror();
    syncMirrorStyle(mirror, window.getComputedStyle(el));

    mirror.textContent = "";
    mirror.append(document.createTextNode(el.value.slice(0, selectionStart)));
    const startMark = document.createElement("span");
    startMark.textContent = "​";
    mirror.append(startMark);
    mirror.append(document.createTextNode(el.value.slice(selectionStart, selectionEnd)));
    const endMark = document.createElement("span");
    endMark.textContent = "​";
    mirror.append(endMark);

    const elRect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;

    const sameLine = startMark.offsetTop === endMark.offsetTop;
    const relLeft = sameLine ? (startMark.offsetLeft + endMark.offsetLeft) / 2 : startMark.offsetLeft;
    const relTop = startMark.offsetTop;

    const x = elRect.left + relLeft - el.scrollLeft;
    const y = elRect.top + relTop - el.scrollTop;

    setAnchor({
      getBoundingClientRect: () => ({
        x,
        y,
        top: y,
        left: x,
        right: x,
        bottom: y + lineHeight,
        width: 0,
        height: lineHeight,
      }),
    });
  }, [textareaRef, getMirror]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handle = () => updateSelection();
    const handleBlur = () => setAnchor(null);
    el.addEventListener("select", handle);
    el.addEventListener("mouseup", handle);
    el.addEventListener("keyup", handle);
    el.addEventListener("scroll", handle);
    el.addEventListener("blur", handleBlur);
    window.addEventListener("resize", handle);
    return () => {
      el.removeEventListener("select", handle);
      el.removeEventListener("mouseup", handle);
      el.removeEventListener("keyup", handle);
      el.removeEventListener("scroll", handle);
      el.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", handle);
    };
  }, [textareaRef, updateSelection]);

  const wrapSelection = useCallback(
    (before: string, after: string = before) => {
      const el = textareaRef.current;
      if (!el) return;
      const { selectionStart, selectionEnd, value: current } = el;
      const selected = current.slice(selectionStart, selectionEnd) || "text";
      const next = current.slice(0, selectionStart) + before + selected + after + current.slice(selectionEnd);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(selectionStart + before.length, selectionStart + before.length + selected.length);
        updateSelection();
      });
    },
    [textareaRef, onChange, updateSelection]
  );

  const clearFormatting = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value: current } = el;
    if (selectionStart === selectionEnd) return;
    const selected = current.slice(selectionStart, selectionEnd);
    const stripped = stripFormatting(selected);
    const next = current.slice(0, selectionStart) + stripped + current.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart, selectionStart + stripped.length);
      updateSelection();
    });
  }, [textareaRef, onChange, updateSelection]);

  return {
    anchor,
    close: () => setAnchor(null),
    wrapSelection,
    clearFormatting,
  };
}
