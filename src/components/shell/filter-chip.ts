import { cn } from "@/lib/utils";

// Kept out of list-header.tsx on purpose: that file is "use client", and a plain
// function exported from it can't be called from a server component (/messages).
export const filterChipClassName = (active: boolean) =>
  cn(
    "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
  );
