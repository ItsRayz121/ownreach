import { UserAvatar } from "@/components/user-avatar";
import { MemberRowActionsMenu } from "./member-row-actions-menu";
import { isCommunityManager } from "@/lib/community-roles";
import type { CommunityMember } from "@/db/schema";

interface MemberRow {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: CommunityMember["role"];
}

const ROLE_LABELS: Record<CommunityMember["role"], string> = { owner: "Owner", admin: "Admin", member: "Member" };

export function MemberList({
  communityId,
  members,
  viewerRole,
}: {
  communityId: string;
  members: MemberRow[];
  viewerRole: CommunityMember["role"];
}) {
  const canManage = isCommunityManager(viewerRole);

  return (
    <ul className="flex flex-col gap-1">
      {members.map((member) => (
        <li key={member.userId} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/40">
          <UserAvatar src={member.avatarUrl} name={member.displayName} className="size-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{member.displayName}</p>
            <p className="text-muted-foreground truncate text-xs">@{member.username}</p>
          </div>
          <span className="text-muted-foreground text-xs">{ROLE_LABELS[member.role]}</span>
          {canManage && (
            <MemberRowActionsMenu
              communityId={communityId}
              memberUserId={member.userId}
              memberRole={member.role}
              viewerRole={viewerRole}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
