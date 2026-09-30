"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";
import { ThemeToggle } from "./theme-toggle";

interface ProfileHeaderActionsProps {
  userId?: string;
  unreadNotifications?: number;
  className?: string;
}

// Notifications + theme toggle, shown in the top-right of the viewer's own
// profile header.
export function ProfileHeaderActions({ userId, unreadNotifications = 0, className }: ProfileHeaderActionsProps) {
  const [unread, setUnread] = useState(unreadNotifications > 0);
  useAblyChannel(userId ? `user:${userId}:notifications` : null, "new", () => setUnread(true));

  return (
    <div className={className ?? "flex items-center"}>
      <Link href="/notifications" aria-label="Notifications" className="hover:bg-accent/60 flex size-10 items-center justify-center rounded-full transition-colors">
        <span className="relative">
          <Bell className="size-5" />
          {unread && <span className="bg-primary absolute -top-0.5 -right-0.5 size-2 rounded-full" />}
        </span>
      </Link>
      <ThemeToggle />
    </div>
  );
}
