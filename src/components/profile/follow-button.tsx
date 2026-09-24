"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFollow } from "@/lib/actions/follows";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FollowButtonProps {
  targetUserId: string;
  targetUsername: string;
  initiallyFollowing: boolean;
}

export function FollowButton({ targetUserId, targetUsername, initiallyFollowing }: FollowButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [following, setOptimisticFollowing] = useOptimistic(initiallyFollowing);
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      setOptimisticFollowing(!following);
      try {
        await toggleFollow(targetUserId, targetUsername);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't update follow status.");
      }
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      variant={following ? "outline" : "default"}
      className="min-w-28"
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
