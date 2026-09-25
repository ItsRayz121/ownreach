import { verifySession } from "@/lib/auth/session";
import { unreadNotificationCount } from "@/lib/data/notifications";
import { hasUnreadMessages } from "@/lib/data/messages";
import { hasUnreadCommunities } from "@/lib/data/communities";
import { AppShell } from "@/components/shell/app-shell";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  const [unreadNotifications, unreadMessages, unreadCommunities] = session
    ? await Promise.all([
        unreadNotificationCount(session.userId),
        hasUnreadMessages(session.userId),
        hasUnreadCommunities(session.userId),
      ])
    : [0, false, false];

  return (
    <AppShell
      userId={session?.userId}
      username={session?.username ?? undefined}
      displayName={session?.displayName ?? undefined}
      unreadNotifications={unreadNotifications}
      unreadMessages={unreadMessages}
      unreadCommunities={unreadCommunities}
      isAdmin={session?.role === "admin"}
    >
      {children}
    </AppShell>
  );
}
