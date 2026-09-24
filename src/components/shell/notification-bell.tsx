"use client";

import { useState } from "react";
import { useAblyChannel } from "@/lib/hooks/use-ably-channel";

interface NotificationBellProps {
  userId: string;
  initialUnread: boolean;
  /** Render prop so the desktop (labeled row) and mobile (icon-only) layouts can each keep their own markup. */
  children: (unread: boolean) => React.ReactNode;
}

// Live-updates the unread dot without a refresh once a new notification
// lands; the actual notification list is only ever read on /notifications
// (see lib/data/notifications.ts) — this just flips a boolean.
export function NotificationBell({ userId, initialUnread, children }: NotificationBellProps) {
  const [unread, setUnread] = useState(initialUnread);

  useAblyChannel(`user:${userId}:notifications`, "new", () => setUnread(true));

  return children(unread);
}
