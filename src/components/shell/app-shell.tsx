import { DesktopSidebar } from "./desktop-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileTopBar } from "./mobile-topbar";

interface AppShellProps {
  userId?: string;
  username?: string;
  displayName?: string;
  unreadNotifications?: number;
  unreadMessages?: boolean;
  unreadCommunities?: boolean;
  isAdmin?: boolean;
  children: React.ReactNode;
}

export function AppShell({
  userId,
  username,
  displayName,
  unreadNotifications = 0,
  unreadMessages = false,
  unreadCommunities = false,
  isAdmin = false,
  children,
}: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl md:px-6">
      <DesktopSidebar
        userId={userId}
        username={username}
        displayName={displayName}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
        unreadCommunities={unreadCommunities}
        isAdmin={isAdmin}
      />
      <div className="flex min-h-dvh w-full flex-1 flex-col md:border-x">
        <MobileTopBar userId={userId} username={username} unreadNotifications={unreadNotifications} isAdmin={isAdmin} />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileBottomNav username={username} unreadMessages={unreadMessages} unreadCommunities={unreadCommunities} />
    </div>
  );
}
