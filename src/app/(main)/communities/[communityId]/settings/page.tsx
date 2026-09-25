import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getCommunityBySlugOrId, getMembership, listMembers } from "@/lib/data/communities";
import { isCommunityManager } from "@/lib/community-roles";
import { CommunitySettingsForm } from "@/components/communities/community-settings-form";
import { MemberList } from "@/components/communities/member-list";

export const metadata = { title: "Community settings / OwnReach", robots: { index: false } };

export default async function CommunitySettingsPage({ params }: { params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  const [session, community] = await Promise.all([verifySession(), getCommunityBySlugOrId(communityId)]);
  if (!session) redirect("/login");
  if (!community) notFound();

  const membership = await getMembership(community.id, session.userId);
  if (!membership || !isCommunityManager(membership.role)) notFound();

  const members = await listMembers(community.id);

  return (
    <div className="p-4">
      <h1 className="mb-6 text-lg font-semibold">Community settings</h1>

      <section className="mb-8">
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">General</h2>
        <CommunitySettingsForm community={community} canDelete={membership.role === "owner"} />
      </section>

      <section>
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Members ({members.length})
        </h2>
        <MemberList communityId={community.id} members={members} viewerRole={membership.role} />
      </section>
    </div>
  );
}
