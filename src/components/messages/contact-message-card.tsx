import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

interface ContactMessageCardProps {
  contact: { userId: string; username: string; displayName: string; avatarUrl: string | null };
  mine?: boolean;
}

export function ContactMessageCard({ contact, mine }: ContactMessageCardProps) {
  return (
    <Link
      href={`/${contact.username}`}
      className={cn(
        "flex min-w-48 items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
        mine ? "border-primary-foreground/20 hover:bg-primary-foreground/10" : "border-border hover:bg-accent/60"
      )}
    >
      <UserAvatar src={contact.avatarUrl} name={contact.displayName} className="size-9 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{contact.displayName}</span>
        <span className={cn("block truncate text-xs", mine ? "opacity-80" : "text-muted-foreground")}>@{contact.username}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 opacity-60" />
    </Link>
  );
}
