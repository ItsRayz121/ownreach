import Link from "next/link";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { listDiscoverableCommunities } from "@/lib/data/communities";
import { CommunityListItem } from "@/components/communities/community-list-item";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Discover communities / OwnReach", robots: { index: false } };

export default async function DiscoverCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string; kind?: string }>;
}) {
  const { q, cursor, kind: rawKind } = await searchParams;
  const query = q?.trim();
  const kind = rawKind === "channel" ? "channel" : "group";
  const session = await verifySession();

  const { items, nextCursor } = await listDiscoverableCommunities({ query, viewerId: session?.userId, cursor, kind });
  const label = kind === "channel" ? "channels" : "groups";

  return (
    <div>
      <div className="bg-background/95 sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3.5 backdrop-blur supports-backdrop-filter:bg-background/80">
        <Link href={`/communities?kind=${kind}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">Discover {label}</h1>
      </div>

      <div className="p-4">
        <form action="/communities/discover" className="relative">
          <input type="hidden" name="kind" value={kind} />
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input name="q" defaultValue={query} placeholder={`Search ${label}`} className="pl-9" />
        </form>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={SearchIcon} title={`No ${label} found`} description="Try a different search, or create your own." />
      ) : (
        items.map((community) => <CommunityListItem key={community.id} community={community} />)
      )}

      {nextCursor && (
        <div className="p-4 text-center">
          <Link
            href={`/communities/discover?kind=${kind}&${query ? `q=${encodeURIComponent(query)}&` : ""}cursor=${nextCursor}`}
            className="text-primary text-sm font-medium hover:underline"
          >
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}
