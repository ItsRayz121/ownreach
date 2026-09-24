import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function MobileTopBar() {
  return (
    <header className="bg-background/95 pt-safe sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
      <Link href="/home" className="text-lg font-semibold tracking-tight">
        OwnReach
      </Link>
      <ThemeToggle />
    </header>
  );
}
