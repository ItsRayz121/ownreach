import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";

export const metadata = { robots: { index: false } };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (!session) redirect("/login?next=/settings/account");

  return <div>{children}</div>;
}
