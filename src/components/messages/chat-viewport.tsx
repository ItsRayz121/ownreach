"use client";

import { useEffect, useRef } from "react";

// Full-screen frame for a conversation on phones: it covers the app chrome
// (top bar, bottom nav) and tracks the *visual* viewport, so the header stays
// put and the composer stays directly above the on-screen keyboard on iOS
// Safari — which, unlike Android Chrome, doesn't shrink the layout viewport
// when the keyboard opens (see `interactiveWidget` in app/layout.tsx). From
// `md` up it's an ordinary in-flow column beside the sidebar.
//
// The message list must be marked `data-chat-list`; the frame keeps its
// scroll position anchored to the bottom while its height changes (keyboard
// opening, composer growing to multiple lines, reply banner appearing).
export function ChatViewport({ children }: { children: React.ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const viewport = window.visualViewport;
    const desktop = window.matchMedia("(min-width: 768px)");
    const list = frame.querySelector<HTMLElement>("[data-chat-list]");
    let distanceFromBottom = 0;

    function onListScroll() {
      if (list) distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    }

    function keepListAnchored() {
      if (list) list.scrollTop = list.scrollHeight - list.clientHeight - distanceFromBottom;
    }

    function fit() {
      if (!frame) return;
      if (desktop.matches || !viewport) {
        frame.style.height = "";
        frame.style.transform = "";
        frame.style.paddingBottom = "";
        document.body.style.overflow = "";
        return;
      }
      const keyboardOpen = window.innerHeight - viewport.height > 120;
      frame.style.height = `${viewport.height}px`;
      frame.style.transform = viewport.offsetTop ? `translateY(${viewport.offsetTop}px)` : "";
      // The home-indicator inset only applies while the keyboard is down.
      frame.style.paddingBottom = keyboardOpen ? "0px" : "";
      document.body.style.overflow = "hidden";
    }

    fit();
    list?.addEventListener("scroll", onListScroll, { passive: true });
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    desktop.addEventListener("change", fit);
    const resizeObserver = new ResizeObserver(keepListAnchored);
    if (list) resizeObserver.observe(list);

    return () => {
      list?.removeEventListener("scroll", onListScroll);
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
      desktop.removeEventListener("change", fit);
      resizeObserver.disconnect();
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className="bg-background fixed inset-x-0 top-0 z-50 flex h-dvh flex-col pb-[env(safe-area-inset-bottom)] md:static md:z-auto md:pb-0"
    >
      {children}
    </div>
  );
}
