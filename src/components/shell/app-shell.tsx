import { DesktopSidebar } from "./desktop-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileTopBar } from "./mobile-topbar";

interface AppShellProps {
  userId?: string;
  username?: string;
  displayName?: string;
  unreadNotifications?: number;
  unreadMessages?: number;
  unreadGroups?: boolean;
  unreadChannels?: boolean;
  isAdmin?: boolean;
  canPost?: boolean;
  children: React.ReactNode;
}

export function AppShell({
  userId,
  username,
  displayName,
  unreadNotifications = 0,
  unreadMessages = 0,
  unreadGroups = false,
  unreadChannels = false,
  isAdmin = false,
  canPost = false,
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
        unreadGroups={unreadGroups}
        unreadChannels={unreadChannels}
        isAdmin={isAdmin}
        canPost={canPost}
      />
      <div className="flex min-h-dvh w-full flex-1 flex-col md:border-x">
        <MobileTopBar username={username} isAdmin={isAdmin} />
        <main className="flex-1 overscroll-y-contain pb-mobile-nav md:pb-0">{children}</main>
      </div>
      <MobileBottomNav
        userId={userId}
        username={username}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
        unreadGroups={unreadGroups}
        unreadChannels={unreadChannels}
        canPost={canPost}
      />
    </div>
  );
}
