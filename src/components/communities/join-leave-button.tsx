"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinCommunity, leaveCommunity } from "@/lib/actions/communities";

export function JoinLeaveButton({ communityId, initiallyMember }: { communityId: string; initiallyMember: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [isMember, setOptimisticMember] = useOptimistic(initiallyMember);
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      setOptimisticMember(!isMember);
      try {
        if (isMember) await leaveCommunity(communityId);
        else await joinCommunity(communityId);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't update your membership.");
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending} variant={isMember ? "outline" : "default"} className="min-w-28">
      {isMember ? "Leave" : "Join"}
    </Button>
  );
}
