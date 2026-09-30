"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// One-tap light/dark switch that shows the mode you'd switch *to* (Moon in
// light mode, Sun in dark). The icon is picked with Tailwind's `dark:` variant
// instead of `resolvedTheme`, which isn't known during server render — so no
// hydration mismatch or flash. next-themes persists the choice.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className={cn("hover:bg-accent/60 flex size-10 items-center justify-center rounded-full transition-colors", className)}
    >
      <Moon className="size-5 dark:hidden" />
      <Sun className="hidden size-5 dark:block" />
    </button>
  );
}
