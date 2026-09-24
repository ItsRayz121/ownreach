"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Reports" },
  { href: "/admin/users", label: "Users" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="mt-3 flex gap-4">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "border-b-2 pb-3 text-sm font-medium transition-colors",
            pathname === tab.href
              ? "border-primary text-foreground"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
