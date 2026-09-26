import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getCommunityBySlugOrId, getChannel, getMembership, listChannelMessages, listMembers } from "@/lib/data/communities";
import { isCommunityManager } from "@/lib/community-roles";
import { ChannelThread } from "@/components/communities/channel-thread";

export async function generateMetadata({ params }: { params: Promise<{ communityId: string; channelId: string }> }) {
  const { channelId } = await params;
  const channel = await getChannel(channelId);
  return { title: channel ? `#${channel.name} / OwnReach` : "Communities / OwnReach" };
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ communityId: string; channelId: string }>;
}) {
  const { communityId, channelId } = await params;
  const [session, community, channel] = await Promise.all([
    verifySession(),
    getCommunityBySlugOrId(communityId),
    getChannel(channelId),
  ]);
  if (!session) redirect("/login");
  if (!community) notFound();
  if (!channel || channel.communityId !== community.id) notFound();

  const membership = await getMembership(community.id, session.userId);
  if (!membership) redirect(`/communities/${community.slug}`);

  const [members, { items, nextCursor }] = await Promise.all([
    listMembers(community.id),
    listChannelMessages(channelId),
  ]);

  const canManage = isCommunityManager(membership.role);
  const canPost = channel.kind === "channel" ? canManage : true;

  return (
    <ChannelThread
      channelId={channelId}
      communityId={community.id}
      communitySlug={community.slug}
      channelName={channel.name}
      avatarUrl={community.avatarUrl}
      viewerId={session.userId}
      members={members}
      canManage={canManage}
      canPost={canPost}
      initialMessages={items}
      initialNextCursor={nextCursor}
    />
  );
}
