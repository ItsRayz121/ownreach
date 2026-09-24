"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveReport, dismissReport } from "@/lib/actions/admin";

export function ReportActions({ reportId }: { reportId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handle(action: (id: string) => Promise<void>) {
    startTransition(async () => {
      try {
        await action(reportId);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't update this report.");
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => handle(dismissReport)}>
        Dismiss
      </Button>
      <Button size="sm" disabled={isPending} onClick={() => handle(resolveReport)}>
        Resolve
      </Button>
    </div>
  );
}
