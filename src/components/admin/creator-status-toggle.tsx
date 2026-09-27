"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCreatorStatus } from "@/lib/actions/admin";

export function CreatorStatusToggle({ userId, isCreator }: { userId: string; isCreator: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      try {
        await setCreatorStatus(userId, !isCreator);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't update this user.");
      }
    });
  }

  return (
    <Button size="sm" variant={isCreator ? "outline" : "default"} disabled={isPending} onClick={handleClick}>
      {isCreator ? "Revoke posting" : "Approve posting"}
    </Button>
  );
}
