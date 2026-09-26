import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getCommunityBySlugOrId, getMembership } from "@/lib/data/communities";

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ communityId: string }>;
}) {
  const { communityId } = await params;
  const [session, community] = await Promise.all([verifySession(), getCommunityBySlugOrId(communityId)]);
  if (!session) redirect("/login");
  if (!community) notFound();

  const membership = await getMembership(community.id, session.userId);
  // Private communities are hidden from Discover but still joinable by direct
  // link — a non-member just can't see the channel chrome until they join.
  if (!membership && community.visibility === "private") notFound();

  return <>{children}</>;
}
