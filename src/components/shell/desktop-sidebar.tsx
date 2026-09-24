"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buildNavItems } from "./nav-items";
import { logout } from "@/lib/actions/auth";

interface DesktopSidebarProps {
  username?: string;
  displayName?: string;
}

export function DesktopSidebar({ username, displayName }: DesktopSidebarProps) {
  const pathname = usePathname();
  const items = buildNavItems(username);
  if (username) {
    items.splice(3, 0, { label: "Bookmarks", href: "/bookmarks", icon: Bookmark });
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between border-r px-3 py-6 md:flex">
      <div>
        <Link href="/home" className="mb-8 block px-3 text-xl font-semibold tracking-tight">
          OwnReach
        </Link>
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/home" && item.href.split("?")[0] !== "/home" && pathname.startsWith(item.href.split("?")[0]));
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                    active ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-accent/60"
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                  {item.comingSoon && (
                    <span className="text-muted-foreground ml-auto text-[10px] tracking-wide uppercase">Soon</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t pt-4">
        {username ? (
          <>
            <div className="mb-2 px-3">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="text-muted-foreground truncate text-xs">@{username}</p>
            </div>
            <form action={logout}>
              <Button type="submit" variant="ghost" className="text-muted-foreground w-full justify-start gap-3">
                <LogOut className="size-4" />
                Log out
              </Button>
            </form>
          </>
        ) : (
          <Button render={<Link href="/login" />} nativeButton={false} className="w-full">
            Log in
          </Button>
        )}
      </div>
    </aside>
  );
}
