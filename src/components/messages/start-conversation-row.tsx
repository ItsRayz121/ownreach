"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { startConversation } from "@/lib/actions/messages";

interface StartConversationRowProps {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export function StartConversationRow({ userId, username, displayName, avatarUrl }: StartConversationRowProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      try {
        const { id } = await startConversation(userId);
        router.push(`/messages/${id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't start that conversation.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="hover:bg-accent/30 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-60"
    >
      <UserAvatar src={avatarUrl} name={displayName} className="size-10 shrink-0" />
      <div className="min-w-0">
        <p className="truncate font-medium">{displayName}</p>
        <p className="text-muted-foreground truncate text-sm">@{username}</p>
      </div>
    </button>
  );
}
