import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { getAblyRest } from "@/lib/realtime/ably-server";
import { listConversations } from "@/lib/data/messages";
import { listChannelIdsForUser } from "@/lib/data/communities";

// Issued token is scoped to exactly the channels this user may read: their
// own notifications channel, one per DM conversation they participate in,
// and one per community channel they're a member of (server-side code is the
// only publisher — clients never need publish capability, see lib/realtime/ably-server.ts).
export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const client = getAblyRest();
  if (!client) return NextResponse.json({ error: "Realtime not configured" }, { status: 501 });

  const [conversations, channelIds] = await Promise.all([
    listConversations(session.userId),
    listChannelIdsForUser(session.userId),
  ]);
  const capability: Record<string, ["subscribe"]> = {
    [`user:${session.userId}:notifications`]: ["subscribe"],
  };
  for (const conversation of conversations) {
    capability[`conversation:${conversation.id}`] = ["subscribe"];
  }
  for (const channelId of channelIds) {
    capability[`channel:${channelId}`] = ["subscribe"];
  }

  const tokenRequest = await client.auth.createTokenRequest({ clientId: session.userId, capability });
  return NextResponse.json(tokenRequest);
}
