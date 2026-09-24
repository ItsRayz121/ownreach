import { DesktopSidebar } from "./desktop-sidebar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileTopBar } from "./mobile-topbar";

interface AppShellProps {
  username?: string;
  displayName?: string;
  children: React.ReactNode;
}

export function AppShell({ username, displayName, children }: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl md:px-6">
      <DesktopSidebar username={username} displayName={displayName} />
      <div className="flex min-h-dvh w-full flex-1 flex-col md:border-x">
        <MobileTopBar />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileBottomNav username={username} />
    </div>
  );
}
