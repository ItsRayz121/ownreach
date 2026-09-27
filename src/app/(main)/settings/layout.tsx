import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata = { robots: { index: false } };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (!session) redirect("/login?next=/settings/profile");

  return (
    <div>
      <div className="border-b px-4 pt-4">
        <h1 className="text-xl font-semibold">Settings</h1>
        <SettingsNav />
      </div>
      {children}
    </div>
  );
}
