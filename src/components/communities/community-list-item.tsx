import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { CommunitySummary } from "@/lib/data/communities";

export function CommunityListItem({ community }: { community: CommunitySummary }) {
  return (
    <Link
      href={`/communities/${community.slug}`}
      className="hover:bg-accent/30 flex items-center gap-3 border-b px-4 py-3.5 transition-colors"
    >
      <UserAvatar src={community.avatarUrl} name={community.name} className="size-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{community.name}</span>
          {community.visibility === "private" && <Lock className="text-muted-foreground size-3 shrink-0" />}
        </div>
        {community.description && (
          <p className="text-muted-foreground truncate text-sm">{community.description}</p>
        )}
      </div>
      <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
        <Users className="size-3.5" />
        {community.memberCount}
      </div>
    </Link>
  );
}
