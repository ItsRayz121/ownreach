"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ProfileHeaderActions } from "./profile-header-actions";

interface MobileTopBarProps {
  userId?: string;
  username?: string;
  isAdmin?: boolean;
  unreadNotifications?: number;
}

// The app's own list pages (Chats, Groups, Channels) carry their own title
// header, so the brand bar would just eat vertical space there. On the
// viewer's own profile the bar also carries Notifications and the theme toggle.
const SELF_HEADED_PATHS = new Set(["/messages", "/communities"]);

export function MobileTopBar({ userId, username, isAdmin = false, unreadNotifications = 0 }: MobileTopBarProps) {
  const pathname = usePathname();
  if (SELF_HEADED_PATHS.has(pathname)) return null;
  const onOwnProfile = Boolean(username) && pathname.toLowerCase() === `/${username}`.toLowerCase();

  return (
    <header className="bg-background/95 pt-safe supports-backdrop-filter:bg-background/80 sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur md:hidden">
      <Link href={username ? "/messages" : "/"} className="text-lg font-semibold tracking-tight">
        OwnReach
      </Link>
      <div className="flex items-center">
        {isAdmin && (
          <Link href="/admin" className="hover:bg-accent/60 flex size-10 items-center justify-center rounded-full" aria-label="Admin">
            <ShieldCheck className="size-5" />
          </Link>
        )}
        {onOwnProfile && <ProfileHeaderActions userId={userId} unreadNotifications={unreadNotifications} />}
      </div>
    </header>
  );
}
