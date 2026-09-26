import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { getCommunityBySlugOrId, getMembership, listChannels } from "@/lib/data/communities";
import { JoinLeaveButton } from "@/components/communities/join-leave-button";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";

export async function generateMetadata({ params }: { params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  const community = await getCommunityBySlugOrId(communityId);
  return { title: community ? `${community.name} / OwnReach` : "Communities / OwnReach" };
}

export default async function CommunityHomePage({ params }: { params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  const [session, community] = await Promise.all([verifySession(), getCommunityBySlugOrId(communityId)]);
  if (!session) redirect("/login");
  if (!community) notFound();

  const membership = await getMembership(community.id, session.userId);

  if (membership) {
    const channels = await listChannels(community.id);
    if (channels.length > 0) redirect(`/communities/${community.slug}/${channels[0].id}`);
    return (
      <EmptyState
        icon={Users}
        title="Setting up…"
        description={
          membership.role === "member"
            ? "This community doesn't have a channel yet — check back soon."
            : "Refresh the page — your channel should be ready."
        }
      />
    );
  }

  if (community.visibility === "private") notFound();

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <UserAvatar src={community.avatarUrl} name={community.name} className="size-16" />
      <div>
        <h1 className="text-xl font-semibold">{community.name}</h1>
        {community.description && <p className="text-muted-foreground mt-1 max-w-sm text-sm">{community.description}</p>}
      </div>
      <JoinLeaveButton communityId={community.id} initiallyMember={false} />
    </div>
  );
}
