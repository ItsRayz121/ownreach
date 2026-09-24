import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { searchPosts, searchProfiles } from "@/lib/data/posts";
import { PostCard } from "@/components/post/post-card";
import { UserAvatar } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Explore / OwnReach" };

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim();
  const session = await verifySession();

  const [profiles, posts] = query
    ? await Promise.all([searchProfiles(query.replace(/^#/, "")), searchPosts(query, session?.userId)])
    : [[], []];

  return (
    <div>
      <div className="bg-background/95 sticky top-0 z-20 border-b p-4 backdrop-blur supports-backdrop-filter:bg-background/80">
        <form action="/explore" className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input name="q" defaultValue={query} placeholder="Search creators, posts, #hashtags" className="pl-9" />
        </form>
      </div>

      {!query && (
        <EmptyState
          icon={SearchIcon}
          title="Find creators and communities"
          description="Search by name, @username, or #hashtag."
        />
      )}

      {query && profiles.length === 0 && posts.length === 0 && (
        <EmptyState icon={SearchIcon} title="No results" description={`Nothing matched "${query}" yet.`} />
      )}

      {profiles.length > 0 && (
        <div className="border-b">
          <h2 className="text-muted-foreground px-4 pt-4 pb-2 text-xs font-semibold tracking-wide uppercase">
            Creators
          </h2>
          <ul>
            {profiles.map((profile) => (
              <li key={profile.userId}>
                <Link href={`/${profile.username}`} className="hover:bg-accent/30 flex items-center gap-3 px-4 py-3">
                  <UserAvatar src={profile.avatarUrl} name={profile.displayName} className="size-10" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{profile.displayName}</p>
                    <p className="text-muted-foreground truncate text-sm">@{profile.username}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {posts.length > 0 && (
        <div>
          <h2 className="text-muted-foreground px-4 pt-4 pb-2 text-xs font-semibold tracking-wide uppercase">
            Posts
          </h2>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} isAuthenticated={Boolean(session)} viewerId={session?.userId} />
          ))}
        </div>
      )}
    </div>
  );
}
