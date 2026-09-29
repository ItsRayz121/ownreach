"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Light/dark switch for the Profile page. The selected segment is styled with
// Tailwind's `dark:` variant instead of reading `resolvedTheme`, which isn't
// known during server render — so there's no hydration mismatch or flash.
export function ThemeSetting() {
  const { setTheme } = useTheme();

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="flex items-center gap-3 text-[15px] font-medium">
        <Sun className="text-muted-foreground size-5 dark:hidden" />
        <Moon className="text-muted-foreground hidden size-5 dark:block" />
        Appearance
      </span>
      <div role="group" aria-label="Theme" className="bg-muted flex rounded-full p-0.5">
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium", "bg-background text-foreground shadow-sm dark:bg-transparent dark:text-muted-foreground dark:shadow-none")}
        >
          <Sun className="size-3.5" />
          Light
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium", "text-muted-foreground dark:bg-background dark:text-foreground dark:shadow-sm")}
        >
          <Moon className="size-3.5" />
          Dark
        </button>
      </div>
    </div>
  );
}
