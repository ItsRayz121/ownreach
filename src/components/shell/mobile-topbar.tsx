"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

interface MobileTopBarProps {
  username?: string;
  isAdmin?: boolean;
}

// The app's own list pages (Chats, Groups, Channels) carry their own title
// header, so the brand bar would just eat vertical space there. Notifications
// and the theme toggle live in Profile rather than up here.
const SELF_HEADED_PATHS = new Set(["/messages", "/communities"]);

export function MobileTopBar({ username, isAdmin = false }: MobileTopBarProps) {
  const pathname = usePathname();
  if (SELF_HEADED_PATHS.has(pathname)) return null;

  return (
    <header className="bg-background/95 pt-safe supports-backdrop-filter:bg-background/80 sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur md:hidden">
      <Link href={username ? "/messages" : "/"} className="text-lg font-semibold tracking-tight">
        OwnReach
      </Link>
      {isAdmin && (
        <Link href="/admin" className="hover:bg-accent/60 flex size-10 items-center justify-center rounded-full" aria-label="Admin">
          <ShieldCheck className="size-5" />
        </Link>
      )}
    </header>
  );
}
