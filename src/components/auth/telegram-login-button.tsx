"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onOwnReachTelegramAuth?: (user: TelegramUser) => void;
  }
}

interface TelegramLoginButtonProps {
  link?: boolean;
}

export function TelegramLoginButton({ link }: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    window.onOwnReachTelegramAuth = async (user: TelegramUser) => {
      setError(null);
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...user, link }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Telegram sign-in failed");
        router.push(data.redirect ?? "/home");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Telegram sign-in failed");
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-onauth", "onOwnReachTelegramAuth(user)");
    script.setAttribute("data-request-access", "");
    containerRef.current.appendChild(script);

    return () => {
      window.onOwnReachTelegramAuth = undefined;
    };
  }, [botUsername, link, router]);

  if (!botUsername) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm">
        Telegram login isn&apos;t configured yet — set <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> and{" "}
        <code>TELEGRAM_BOT_TOKEN</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} className="flex justify-center" />
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
