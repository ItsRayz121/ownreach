"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ShieldCheck, ShieldMinus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { promoteMember, demoteMember, removeMember } from "@/lib/actions/communities";
import type { CommunityMember } from "@/db/schema";

interface MemberRowActionsMenuProps {
  communityId: string;
  memberUserId: string;
  memberRole: CommunityMember["role"];
  viewerRole: CommunityMember["role"];
}

export function MemberRowActionsMenu({ communityId, memberUserId, memberRole, viewerRole }: MemberRowActionsMenuProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (memberRole === "owner") return null;
  // Admins may only remove plain members — promote/demote is owner-only, and
  // an admin can't remove another admin (prevents privilege-escalation loops).
  if (viewerRole === "admin" && memberRole === "admin") return null;

  function run(action: () => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't do that.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="text-muted-foreground hover:text-foreground rounded-full p-1.5 hover:bg-accent/60"
        aria-label="Member actions"
        disabled={isPending}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {viewerRole === "owner" && memberRole === "member" && (
          <DropdownMenuItem onClick={() => run(() => promoteMember(communityId, memberUserId), "Promoted to admin.")}>
            <ShieldCheck />
            Make admin
          </DropdownMenuItem>
        )}
        {viewerRole === "owner" && memberRole === "admin" && (
          <DropdownMenuItem onClick={() => run(() => demoteMember(communityId, memberUserId), "Moved back to member.")}>
            <ShieldMinus />
            Remove admin
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={() => run(() => removeMember(communityId, memberUserId), "Member removed.")}>
          <UserMinus />
          Remove from community
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
