import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Page not found / OwnReach" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <Link href="/" aria-label="OwnReach home">
        <Logo size={40} textClassName="text-xl" />
      </Link>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Button render={<Link href="/messages" />} nativeButton={false} className="mt-2">
            Back to Chats
          </Button>
        }
      />
    </div>
  );
}
