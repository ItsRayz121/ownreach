import Link from "next/link";
import { Users, Compass } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { listMyCommunities } from "@/lib/data/communities";
import { CommunityListItem } from "@/components/communities/community-list-item";
import { CreateCommunityDialog } from "@/components/communities/create-community-dialog";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Communities / OwnReach", robots: { index: false } };

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind: rawKind } = await searchParams;
  const kind = rawKind === "channel" ? "channel" : "group";
  const session = await verifySession();
  if (!session) return null; // layout already redirects

  const myCommunities = await listMyCommunities(session.userId, { kind });
  const label = kind === "channel" ? "Channels" : "Groups";

  return (
    <div>
      <div className="bg-background/95 sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3.5 backdrop-blur supports-backdrop-filter:bg-background/80">
        <h1 className="text-lg font-semibold">{label}</h1>
        <Link
          href={`/communities/discover?kind=${kind}`}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium"
        >
          <Compass className="size-4" />
          Discover
        </Link>
      </div>

      <div className="p-4">
        <CreateCommunityDialog defaultKind={kind} />
      </div>

      {myCommunities.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`No ${label.toLowerCase()} yet`}
          description={`Create one, or discover public ${label.toLowerCase()} to join.`}
        />
      ) : (
        myCommunities.map((community) => <CommunityListItem key={community.id} community={community} />)
      )}
    </div>
  );
}
