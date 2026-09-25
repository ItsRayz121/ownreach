"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hash, Settings } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { CreateChannelDialog } from "./create-channel-dialog";
import { isCommunityManager, type ChannelSummary } from "@/lib/data/communities";
import type { CommunityMember } from "@/db/schema";

interface ChannelSidebarProps {
  community: { id: string; slug: string; name: string; avatarUrl: string | null };
  channels: ChannelSummary[];
  role: CommunityMember["role"];
}

export function ChannelSidebar({ community, channels, role }: ChannelSidebarProps) {
  const pathname = usePathname();
  const canManage = isCommunityManager(role);

  return (
    <aside className="flex w-full shrink-0 flex-col border-r md:w-64">
      <div className="flex items-center gap-2.5 border-b px-4 py-3.5">
        <UserAvatar src={community.avatarUrl} name={community.name} className="size-8" />
        <Link href={`/communities/${community.slug}`} className="min-w-0 flex-1">
          <p className="truncate font-semibold">{community.name}</p>
        </Link>
        {canManage && (
          <Link
            href={`/communities/${community.slug}/settings`}
            className="text-muted-foreground hover:text-foreground rounded-full p-1.5 hover:bg-accent/60"
            aria-label="Community settings"
          >
            <Settings className="size-4" />
          </Link>
        )}
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {channels.map((channel) => {
          const href = `/communities/${community.slug}/${channel.id}`;
          const active = pathname === href;
          return (
            <li key={channel.id}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active ? "bg-accent text-accent-foreground font-medium" : "text-foreground/80 hover:bg-accent/60"
                )}
              >
                <Hash className="size-4 shrink-0" />
                <span className="truncate">{channel.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {canManage && (
        <div className="border-t p-2">
          <CreateChannelDialog communityId={community.id} communitySlug={community.slug} />
        </div>
      )}
    </aside>
  );
}
