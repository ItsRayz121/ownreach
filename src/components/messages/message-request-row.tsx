"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { acceptMessageRequest, declineMessageRequest } from "@/lib/actions/messages";

interface MessageRequestRowProps {
  conversationId: string;
  displayName: string;
  avatarUrl: string | null;
  preview: string;
}

export function MessageRequestRow({ conversationId, displayName, avatarUrl, preview }: MessageRequestRowProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handle(action: (id: string) => Promise<unknown>) {
    startTransition(async () => {
      try {
        await action(conversationId);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't update this request.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3.5">
      <Link href={`/messages/${conversationId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar src={avatarUrl} name={displayName} className="size-11 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="text-muted-foreground truncate text-sm">{preview}</p>
        </div>
      </Link>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" disabled={isPending} onClick={() => handle(acceptMessageRequest)}>
          Accept
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => handle(declineMessageRequest)}>
          Decline
        </Button>
      </div>
    </div>
  );
}
