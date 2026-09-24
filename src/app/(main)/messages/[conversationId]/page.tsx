import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getOtherParticipant, isParticipant, listMessages } from "@/lib/data/messages";
import { MessageThread } from "@/components/messages/message-thread";

export async function generateMetadata({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await verifySession();
  if (!session) return { title: "Messages / OwnReach" };
  const other = await getOtherParticipant(conversationId, session.userId);
  return { title: other ? `${other.displayName} / Messages / OwnReach` : "Messages / OwnReach" };
}

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await verifySession();
  if (!session) redirect("/login");

  const participant = await isParticipant(conversationId, session.userId);
  if (!participant) notFound();

  const [other, { items, nextCursor }] = await Promise.all([
    getOtherParticipant(conversationId, session.userId),
    listMessages(conversationId),
  ]);

  return (
    <MessageThread
      conversationId={conversationId}
      viewerId={session.userId}
      other={other}
      initialMessages={items}
      initialNextCursor={nextCursor}
    />
  );
}
