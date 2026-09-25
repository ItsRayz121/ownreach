import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getCommunityBySlugOrId, getChannel, getMembership, listChannelMessages, listMembers } from "@/lib/data/communities";
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

  return (
    <ChannelThread
      channelId={channelId}
      communityId={community.id}
      channelName={channel.name}
      viewerId={session.userId}
      members={members}
      initialMessages={items}
      initialNextCursor={nextCursor}
    />
  );
}
