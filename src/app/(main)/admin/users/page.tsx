import { Search as SearchIcon } from "lucide-react";
import { listUsers } from "@/lib/data/admin";
import { Input } from "@/components/ui/input";
import { UserStatusToggle } from "@/components/admin/user-status-toggle";
import { formatRelativeTime } from "@/lib/format";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim();
  const users = await listUsers(query);

  return (
    <div>
      <div className="border-b p-4">
        <form action="/admin/users" className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input name="q" defaultValue={query} placeholder="Search by name or @username" className="pl-9" />
        </form>
      </div>

      {users.map((user) => (
        <div key={user.id} className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              {user.role !== "user" && (
                <span className="text-muted-foreground text-[10px] tracking-wide uppercase">{user.role}</span>
              )}
              {user.status === "suspended" && (
                <span className="text-destructive text-[10px] font-medium tracking-wide uppercase">Suspended</span>
              )}
            </div>
            <p className="text-muted-foreground truncate text-xs">
              @{user.username} · joined {formatRelativeTime(user.createdAt)}
            </p>
          </div>
          {user.role !== "admin" && <UserStatusToggle userId={user.id} status={user.status} />}
        </div>
      ))}
    </div>
  );
}
