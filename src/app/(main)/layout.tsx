import { verifySession } from "@/lib/auth/session";
import { unreadNotificationCount } from "@/lib/data/notifications";
import { hasUnreadMessages } from "@/lib/data/messages";
import { hasUnreadGroups, hasUnreadChannels } from "@/lib/data/communities";
import { AppShell } from "@/components/shell/app-shell";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  const [unreadNotifications, unreadMessages, unreadGroups, unreadChannels] = session
    ? await Promise.all([
        unreadNotificationCount(session.userId),
        hasUnreadMessages(session.userId),
        hasUnreadGroups(session.userId),
        hasUnreadChannels(session.userId),
      ])
    : [0, false, false, false];

  return (
    <AppShell
      userId={session?.userId}
      username={session?.username ?? undefined}
      displayName={session?.displayName ?? undefined}
      unreadNotifications={unreadNotifications}
      unreadMessages={unreadMessages}
      unreadGroups={unreadGroups}
      unreadChannels={unreadChannels}
      isAdmin={session?.role === "admin"}
    >
      {children}
    </AppShell>
  );
}
