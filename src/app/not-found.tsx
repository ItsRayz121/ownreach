import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Page not found / OwnReach" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Button render={<Link href="/home" />} nativeButton={false} className="mt-2">
            Back to Home
          </Button>
        }
      />
    </div>
  );
}
