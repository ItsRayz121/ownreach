"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildNavItems } from "./nav-items";

export function MobileBottomNav({ username }: { username?: string }) {
  const pathname = usePathname();
  const items = buildNavItems(username);

  return (
    <nav className="bg-background/95 pb-safe fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href.split("?")[0]) && item.href !== "/home?compose=1");
          const Icon = item.icon;
          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
