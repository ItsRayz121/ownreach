import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { getAblyRest } from "@/lib/realtime/ably-server";
import { listConversations } from "@/lib/data/messages";

// Issued token is scoped to exactly the channels this user may read: their
// own notifications channel, plus one per conversation they participate in
// (server-side code is the only publisher — clients never need publish
// capability, see lib/realtime/ably-server.ts).
export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const client = getAblyRest();
  if (!client) return NextResponse.json({ error: "Realtime not configured" }, { status: 501 });

  const conversations = await listConversations(session.userId);
  const capability: Record<string, ["subscribe"]> = {
    [`user:${session.userId}:notifications`]: ["subscribe"],
  };
  for (const conversation of conversations) {
    capability[`conversation:${conversation.id}`] = ["subscribe"];
  }

  const tokenRequest = await client.auth.createTokenRequest({ clientId: session.userId, capability });
  return NextResponse.json(tokenRequest);
}
