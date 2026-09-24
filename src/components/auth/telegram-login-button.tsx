"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Status = "idle" | "opening" | "waiting" | "error";

interface TelegramLoginButtonProps {
  link?: boolean;
}

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 5 * 60 * 1000;

export function TelegramLoginButton({ link }: TelegramLoginButtonProps) {
  const router = useRouter();
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadline = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/telegram/status", { method: "POST" });
      const data = await res.json();

      if (data.status === "done") {
        stopPolling();
        router.push(data.redirect ?? "/home");
        router.refresh();
      } else if (data.status === "error") {
        stopPolling();
        setStatus("error");
        setError(data.error ?? "Telegram sign-in failed");
      } else if (data.status === "expired" || Date.now() > deadline.current) {
        stopPolling();
        setStatus("error");
        setError("That Telegram login link expired. Please try again.");
      }
    } catch {
      // Transient network hiccup — keep polling until it succeeds or times out.
    }
  }, [router, stopPolling]);

  // Catches the case where the user confirmed in Telegram and switched back
  // to this tab before the next scheduled poll tick fires.
  useEffect(() => {
    if (status !== "waiting") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [status, poll]);

  const startLogin = async () => {
    setError(null);
    setStatus("opening");

    // Opened synchronously, inside the click handler, so mobile Safari counts
    // it as user-activated — a window.open() issued after the awaited fetch
    // below would otherwise get silently popup-blocked.
    const popup = window.open("", "_blank");

    try {
      const res = await fetch("/api/auth/telegram/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start Telegram sign-in");

      setDeepLink(data.deepLink);
      if (popup) {
        popup.location.href = data.deepLink;
      }

      setStatus("waiting");
      deadline.current = Date.now() + MAX_WAIT_MS;
      pollTimer.current = setInterval(poll, POLL_INTERVAL_MS);
    } catch (e) {
      popup?.close();
      setStatus("error");
      setError(e instanceof Error ? e.message : "Couldn't start Telegram sign-in");
    }
  };

  if (!botUsername) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm">
        Telegram login isn&apos;t configured yet — set <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> and{" "}
        <code>TELEGRAM_BOT_TOKEN</code>.
      </p>
    );
  }

  const label =
    status === "opening" ? "Opening Telegram…" : status === "waiting" ? "Signing you in…" : link ? "Connect Telegram" : "Login with Telegram";

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-3"
        onClick={startLogin}
        disabled={status === "opening" || status === "waiting"}
      >
        <TelegramGlyph />
        {label}
      </Button>
      {status === "waiting" && deepLink && (
        <a href={deepLink} target="_blank" rel="noopener noreferrer" className="text-primary text-center text-xs underline">
          Telegram didn&apos;t open? Tap here
        </a>
      )}
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
    </div>
  );
}

function TelegramGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="9" fill="#26A5E4" />
      <path
        fill="#fff"
        d="M13.7 5.2 12 13.1c-.13.58-.47.72-.95.45l-2.63-1.94-1.27 1.22c-.14.14-.26.26-.53.26l.19-2.68 4.88-4.41c.21-.19-.05-.3-.33-.11L5.4 9.7 2.78 8.88c-.57-.18-.58-.57.12-.84l10.24-3.95c.47-.17.89.11.56.9Z"
      />
    </svg>
  );
}
