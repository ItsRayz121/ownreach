"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { suspendUser, reinstateUser } from "@/lib/actions/admin";

export function UserStatusToggle({ userId, status }: { userId: string; status: "active" | "suspended" }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      try {
        await (status === "active" ? suspendUser(userId) : reinstateUser(userId));
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't update this user.");
      }
    });
  }

  return (
    <Button size="sm" variant={status === "active" ? "destructive" : "outline"} disabled={isPending} onClick={handleClick}>
      {status === "active" ? "Suspend" : "Reinstate"}
    </Button>
  );
}
