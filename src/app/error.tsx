"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description="Give it another try — if this keeps happening, let us know."
        action={
          <Button onClick={reset} className="mt-2">
            Try again
          </Button>
        }
      />
    </div>
  );
}
