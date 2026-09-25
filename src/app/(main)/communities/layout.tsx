import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";

export default async function CommunitiesLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (!session) redirect("/login");
  return <>{children}</>;
}
