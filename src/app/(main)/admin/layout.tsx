import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { AdminTabs } from "@/components/admin/admin-tabs";

export const metadata = { title: "Admin / OwnReach", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "admin") redirect("/home");

  return (
    <div>
      <div className="border-b px-4 pt-4">
        <h1 className="text-xl font-semibold">Admin</h1>
        <AdminTabs />
      </div>
      {children}
    </div>
  );
}
