"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";
import { buildNavItems, isNavItemActive } from "./nav-items";
import { NavBadge } from "./nav-badge";

interface MobileBottomNavProps {
  userId?: string;
  username?: string;
  unreadMessages?: number;
  unreadGroups?: boolean;
  unreadChannels?: boolean;
  unreadNotifications?: number;
  canPost?: boolean;
}

export function MobileBottomNav({
  userId,
  username,
  unreadMessages = 0,
  unreadGroups = false,
  unreadChannels = false,
  unreadNotifications = 0,
  canPost = false,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Notifications live under Profile on phones, so the Profile tab carries
  // their unread dot: flipped on by a realtime event, cleared once the
  // notifications page has been opened.
  const [notificationsUnread, setNotificationsUnread] = useState(unreadNotifications > 0);
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (pathname === "/notifications") setNotificationsUnread(false);
  }
  useAblyChannel(userId ? `user:${userId}:notifications` : null, "new", () => setNotificationsUnread(true));

  const items = buildNavItems(
    username,
    { messages: unreadMessages, groups: unreadGroups, channels: unreadChannels, notifications: notificationsUnread },
    canPost
  );

  return (
    <nav aria-label="Primary" className="bg-background h-mobile-nav transform-gpu fixed inset-x-0 bottom-0 z-40 border-t md:hidden">
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname, searchParams);
          const Icon = item.icon;
          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                  <NavBadge badge={item.badge} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
