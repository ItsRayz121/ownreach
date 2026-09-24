import Link from "next/link";
import { Bell } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "./notification-bell";

interface MobileTopBarProps {
  userId?: string;
  username?: string;
  unreadNotifications?: number;
}

export function MobileTopBar({ userId, username, unreadNotifications = 0 }: MobileTopBarProps) {
  return (
    <header className="bg-background/95 pt-safe sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
      <Link href="/home" className="text-lg font-semibold tracking-tight">
        OwnReach
      </Link>
      <div className="flex items-center gap-1">
        {username && userId && (
          <NotificationBell userId={userId} initialUnread={unreadNotifications > 0}>
            {(unread) => (
              <Link href="/notifications" className="relative rounded-full p-2 hover:bg-accent/60" aria-label="Notifications">
                <Bell className="size-5" />
                {unread && <span className="bg-primary absolute top-1.5 right-1.5 size-2 rounded-full" />}
              </Link>
            )}
          </NotificationBell>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
