import Link from "next/link";
import { Sparkles } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { getFeed } from "@/lib/data/posts";
import { PostCard } from "@/components/post/post-card";
import { PostComposer } from "@/components/post/post-composer";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export const metadata = { title: "Home / OwnReach", robots: { index: false } };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cursor?: string }>;
}) {
  const { tab, cursor } = await searchParams;
  const session = await verifySession();
  const scope = tab === "following" ? "following" : "for-you";

  const { items, nextCursor } = await getFeed({ scope, viewerId: session?.userId, cursor });

  return (
    <div>
      <div className="bg-background/95 sticky top-0 z-20 flex border-b backdrop-blur supports-backdrop-filter:bg-background/80 md:top-0">
        <Tab href="/home" active={scope === "for-you"} label="For You" />
        <Tab href="/home?tab=following" active={scope === "following"} label="Following" />
      </div>

      {session && <PostComposer displayName={session.displayName ?? "You"} avatarUrl={session.avatarUrl} />}

      {items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={scope === "following" ? "Your feed is quiet" : "No posts yet"}
          description={
            scope === "following"
              ? "Follow creators to personalize your feed."
              : "Be the first to share something with the network."
          }
          action={
            scope === "following" && (
              <Link href="/explore" className="text-primary text-sm font-medium hover:underline">
                Explore creators
              </Link>
            )
          }
        />
      ) : (
        <>
          {items.map((post) => (
            <PostCard key={post.id} post={post} isAuthenticated={Boolean(session)} />
          ))}
          {nextCursor && (
            <div className="p-4 text-center">
              <Link
                href={`/home?tab=${scope}&cursor=${nextCursor}`}
                className="text-primary text-sm font-medium hover:underline"
              >
                Load more
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 border-b-2 py-3.5 text-center text-sm font-semibold transition-colors",
        active ? "border-primary text-foreground" : "text-muted-foreground border-transparent hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}
