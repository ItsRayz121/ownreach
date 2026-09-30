"use server";

import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { listConversations } from "@/lib/data/messages";
import { listMyCommunities } from "@/lib/data/communities";
import { isCommunityManager } from "@/lib/community-roles";
import { sendMessage } from "@/lib/actions/messages";
import { sendChannelMessage } from "@/lib/actions/communities";

export interface ForwardTarget {
  type: "conversation" | "channel";
  /** Conversation id, or the community's default channel id. */
  id: string;
  name: string;
  avatarUrl: string | null;
  detail: string;
}

/** Everywhere the viewer could send a forwarded message: their chats, plus groups (and channels they administer). */
export async function listForwardTargets(): Promise<ForwardTarget[]> {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const [conversations, communities] = await Promise.all([listConversations(session.userId), listMyCommunities(session.userId)]);

  const postable = communities.filter((c) => c.kind === "group" || isCommunityManager(c.role));
  const channelRows = postable.length
    ? await db
        .select({ id: channels.id, communityId: channels.communityId })
        .from(channels)
        .where(inArray(channels.communityId, postable.map((c) => c.id)))
        .orderBy(asc(channels.position), asc(channels.createdAt))
    : [];
  const defaultChannel = new Map<string, string>();
  for (const row of channelRows) if (!defaultChannel.has(row.communityId)) defaultChannel.set(row.communityId, row.id);

  const targets: ForwardTarget[] = [];
  for (const c of conversations) {
    if (!c.other || c.status === "declined") continue;
    targets.push({ type: "conversation", id: c.id, name: c.other.displayName, avatarUrl: c.other.avatarUrl, detail: `@${c.other.username}` });
  }
  for (const c of postable) {
    const channelId = defaultChannel.get(c.id);
    if (!channelId) continue;
    targets.push({ type: "channel", id: channelId, name: c.name, avatarUrl: c.avatarUrl, detail: c.kind === "channel" ? "Channel" : "Group" });
  }
  return targets;
}

/** Sends `body` to `target` through the normal send actions, so every existing permission, request and rate-limit check still applies. */
export async function forwardMessageText(target: { type: "conversation" | "channel"; id: string }, body: string) {
  const text = body.trim();
  if (!text) throw new Error("There's nothing to forward.");
  if (target.type === "conversation") await sendMessage({ conversationId: target.id, body: text });
  else await sendChannelMessage({ channelId: target.id, body: text });
}
