import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { getBookmarkedPosts } from "@/lib/data/posts";
import { PostCard } from "@/components/post/post-card";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Bookmarks / OwnReach", robots: { index: false } };

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const session = await verifySession();
  if (!session) redirect("/login");

  const { items, nextCursor } = await getBookmarkedPosts(session.userId, cursor);

  return (
    <div>
      <div className="bg-background/95 sticky top-0 z-20 border-b px-4 py-3.5 backdrop-blur supports-backdrop-filter:bg-background/80">
        <h1 className="text-lg font-semibold">Bookmarks</h1>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No bookmarks yet"
          description="Tap the bookmark icon on any post to save it here."
        />
      ) : (
        <>
          {items.map((post) => (
            <PostCard key={post.id} post={post} isAuthenticated viewerId={session.userId} viewerRole={session.role} />
          ))}
          {nextCursor && (
            <div className="p-4 text-center">
              <Link href={`/bookmarks?cursor=${nextCursor}`} className="text-primary text-sm font-medium hover:underline">
                Load more
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
