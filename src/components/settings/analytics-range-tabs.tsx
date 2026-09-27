"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AnalyticsRange } from "@/lib/data/analytics";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "1y", label: "1 year" },
];

export function AnalyticsRangeTabs({ current }: { current: AnalyticsRange }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex gap-1.5">
      {RANGES.map((r) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("range", r.value);
        return (
          <Link
            key={r.value}
            href={`${pathname}?${params.toString()}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              current === r.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}
