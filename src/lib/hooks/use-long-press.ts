"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

interface UseLongPressOptions {
  /** How long a touch must be held before firing. */
  delay?: number;
  /** How far (px) the finger may drift before the press is treated as a scroll. */
  moveTolerance?: number;
}

/**
 * Touch/pen long-press plus right-click, both routed to one callback — the
 * mobile and desktop ways of opening a message's context menu. Returns
 * handlers to spread onto the pressable element.
 *
 * Mouse presses are deliberately ignored here (a held mouse button is a text
 * selection, not a menu request); the browser's `contextmenu` event covers
 * right-click, and Android's long-press also fires it — `firedRef` keeps the
 * two paths from opening the menu twice.
 */
export function useLongPress(onLongPress: () => void, { delay = 420, moveTolerance = 10 }: UseLongPressOptions = {}) {
  const timerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const callbackRef = useRef(onLongPress);

  useEffect(() => {
    callbackRef.current = onLongPress;
  });

  function cancel() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    originRef.current = null;
  }

  useEffect(() => cancel, []);

  function fire() {
    if (firedRef.current) return;
    firedRef.current = true;
    navigator.vibrate?.(8);
    callbackRef.current();
  }

  return {
    onPointerDown(e: PointerEvent) {
      firedRef.current = false;
      if (e.pointerType === "mouse" || !e.isPrimary) return;
      originRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        fire();
      }, delay);
    },
    onPointerMove(e: PointerEvent) {
      const origin = originRef.current;
      if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > moveTolerance) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(e: MouseEvent) {
      e.preventDefault();
      cancel();
      fire();
    },
    // A long press that opened the menu shouldn't also activate whatever
    // link/button the finger happened to be resting on when it lifts.
    onClickCapture(e: MouseEvent) {
      if (firedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        firedRef.current = false;
      }
    },
  };
}
