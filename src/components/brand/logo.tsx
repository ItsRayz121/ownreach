import Image from "next/image";
import { cn } from "@/lib/utils";

// The mark is navy + blue on transparent, so it disappears on the dark theme.
// It always sits on a white tile — same treatment as the installed app icon.
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[22%] bg-white shadow-sm ring-1 ring-black/5", className)}
      style={{ width: size, height: size }}
    >
      <Image src="/logo-mark.png" alt="" width={249} height={135} priority style={{ width: "78%", height: "auto" }} />
    </span>
  );
}

// Mark + "Own" / "Reach" wordmark, matching the brand logo's two-tone name.
export function Logo({ size = 32, textClassName, className }: { size?: number; textClassName?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className={cn("font-bold tracking-tight", textClassName)}>
        Own<span className="text-[#1a8cff]">Reach</span>
      </span>
    </span>
  );
}
