import { verifySession } from "@/lib/auth/session";
import { unreadNotificationCount } from "@/lib/data/notifications";
import { AppShell } from "@/components/shell/app-shell";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  const unreadNotifications = session ? await unreadNotificationCount(session.userId) : 0;

  return (
    <AppShell
      userId={session?.userId}
      username={session?.username ?? undefined}
      displayName={session?.displayName ?? undefined}
      unreadNotifications={unreadNotifications}
      isAdmin={session?.role === "admin"}
    >
      {children}
    </AppShell>
  );
}
