import { verifySession } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/app-shell";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();

  return (
    <AppShell username={session?.username ?? undefined} displayName={session?.displayName ?? undefined}>
      {children}
    </AppShell>
  );
}
