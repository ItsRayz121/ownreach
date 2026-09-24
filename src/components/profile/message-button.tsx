"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startConversation } from "@/lib/actions/messages";
import { toast } from "sonner";

export function MessageButton({ targetUserId }: { targetUserId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      try {
        const { id } = await startConversation(targetUserId);
        router.push(`/messages/${id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't start a conversation.");
      }
    });
  }

  return (
    <Button variant="outline" size="icon" onClick={handleClick} disabled={isPending} aria-label="Message">
      <MessageCircle className="size-4" />
    </Button>
  );
}
