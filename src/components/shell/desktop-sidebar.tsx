"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, Bell, Bookmark, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buildNavItems, isNavItemActive } from "./nav-items";
import { logout } from "@/lib/actions/auth";
import { NotificationBell } from "./notification-bell";

interface DesktopSidebarProps {
  userId?: string;
  username?: string;
  displayName?: string;
  unreadNotifications?: number;
  unreadMessages?: boolean;
  unreadGroups?: boolean;
  unreadChannels?: boolean;
  isAdmin?: boolean;
}

export function DesktopSidebar({
  userId,
  username,
  displayName,
  unreadNotifications = 0,
  unreadMessages = false,
  unreadGroups = false,
  unreadChannels = false,
  isAdmin = false,
}: DesktopSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = buildNavItems(username, { messages: unreadMessages, groups: unreadGroups, channels: unreadChannels });

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between border-r px-3 py-6 md:flex">
      <div>
        <Link href="/home" className="mb-8 block px-3 text-xl font-semibold tracking-tight">
          OwnReach
        </Link>
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isNavItemActive(item, pathname, searchParams);
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                    active ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-accent/60"
                  )}
                >
                  <span className="relative">
                    <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                    {item.badge && <span className="bg-primary absolute -top-1 -right-1 size-2 rounded-full" />}
                  </span>
                  {item.label}
                  {item.comingSoon && (
                    <span className="text-muted-foreground ml-auto text-[10px] tracking-wide uppercase">Soon</span>
                  )}
                </Link>
              </li>
            );
          })}
          {username && (
            <li>
              <Link
                href="/bookmarks"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                  pathname === "/bookmarks" ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-accent/60"
                )}
              >
                <Bookmark className="size-5" strokeWidth={pathname === "/bookmarks" ? 2.4 : 2} />
                Bookmarks
              </Link>
            </li>
          )}
          {username && userId && (
            <li>
              <NotificationBell userId={userId} initialUnread={unreadNotifications > 0}>
                {(unread) => (
                  <Link
                    href="/notifications"
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                      pathname === "/notifications" ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-accent/60"
                    )}
                  >
                    <span className="relative">
                      <Bell className="size-5" strokeWidth={pathname === "/notifications" ? 2.4 : 2} />
                      {unread && <span className="bg-primary absolute -top-1 -right-1 size-2 rounded-full" />}
                    </span>
                    Notifications
                  </Link>
                )}
              </NotificationBell>
            </li>
          )}
          {isAdmin && (
            <li>
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                  pathname.startsWith("/admin") ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-accent/60"
                )}
              >
                <ShieldCheck className="size-5" strokeWidth={pathname.startsWith("/admin") ? 2.4 : 2} />
                Admin
              </Link>
            </li>
          )}
        </ul>
      </div>

      <div className="border-t pt-4">
        {username ? (
          <>
            <div className="mb-2 px-3">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="text-muted-foreground truncate text-xs">@{username}</p>
            </div>
            <form action={logout}>
              <Button type="submit" variant="ghost" className="text-muted-foreground w-full justify-start gap-3">
                <LogOut className="size-4" />
                Log out
              </Button>
            </form>
          </>
        ) : (
          <Button render={<Link href="/login" />} nativeButton={false} className="w-full">
            Log in
          </Button>
        )}
      </div>
    </aside>
  );
}
