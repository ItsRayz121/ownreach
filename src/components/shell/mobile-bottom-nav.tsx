"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildNavItems, isNavItemActive } from "./nav-items";

interface MobileBottomNavProps {
  username?: string;
  unreadMessages?: boolean;
  unreadGroups?: boolean;
  unreadChannels?: boolean;
}

export function MobileBottomNav({
  username,
  unreadMessages = false,
  unreadGroups = false,
  unreadChannels = false,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = buildNavItems(username, { messages: unreadMessages, groups: unreadGroups, channels: unreadChannels });

  return (
    <nav className="bg-background h-mobile-nav transform-gpu fixed inset-x-0 bottom-0 z-40 border-t md:hidden">
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname, searchParams);
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
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                  {item.badge && <span className="bg-primary absolute -top-0.5 -right-1 size-2 rounded-full" />}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
