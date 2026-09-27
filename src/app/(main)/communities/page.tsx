import { verifySession } from "@/lib/auth/session";
import { listMyCommunities } from "@/lib/data/communities";
import { CommunitiesView } from "@/components/communities/communities-view";

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

  return <CommunitiesView communities={myCommunities} kind={kind} label={label} />;
}
