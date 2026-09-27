"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { communities, communityMembers, channels, channelMessages, channelMessageReactions } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { getMembership, getChannel, listChannelMessages, recordChannelMessageViews } from "@/lib/data/communities";
import { publishToChannel } from "@/lib/realtime/ably-server";
import { isUniqueViolation } from "@/lib/db-errors";
import { isCommunityManager } from "@/lib/community-roles";
import { isMessageReactionEmoji } from "@/lib/reactions";
import { toggleReactionCore } from "@/lib/actions/reaction-toggle";

type CommunityRole = "owner" | "admin" | "member";

// Community pages are addressed by slug (e.g. /communities/my-club), but
// actions here only ever receive the community's real id — revalidating a
// literal `/communities/${communityId}` path would invalidate a URL nobody
// actually visits. The dynamic-segment + "layout" form matches by route file
// structure regardless of which value (slug or id) resolves the page, and
// cascades to every nested page (settings, channels) automatically.
const COMMUNITY_LAYOUT_PATH = "/(main)/communities/[communityId]";

async function requireCommunityRole(communityId: string, allowedRoles: CommunityRole[]) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");
  const membership = await getMembership(communityId, session.userId);
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new Error("You don't have permission to do that.");
  }
  return { session, membership };
}

const createCommunitySchema = z.object({
  name: z.string().trim().min(2, "Give it a name.").max(60, "Keep the name under 60 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,30}$/, "Use 3-30 lowercase letters, numbers, or hyphens."),
  description: z.string().trim().max(500, "Keep the description under 500 characters.").optional(),
  visibility: z.enum(["public", "private"]),
  kind: z.enum(["group", "channel"]).default("group"),
  avatarUrl: z.string().url().optional(),
});

export async function createCommunity(input: z.infer<typeof createCommunitySchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to create a community.");
  await checkRateLimit("community:create", session.userId, { limit: 5, window: "60 m" });

  const parsed = createCommunitySchema.parse(input);

  try {
    const { community, defaultChannelId } = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(communities)
        .values({
          name: parsed.name,
          slug: parsed.slug,
          description: parsed.description,
          visibility: parsed.visibility,
          kind: parsed.kind,
          avatarUrl: parsed.avatarUrl,
        })
        .returning();
      await tx.insert(communityMembers).values({ communityId: created.id, userId: session.userId, role: "owner" });
      // Every group/channel ships with exactly one ready-to-use chat stream —
      // no separate "add a channel" step for the creator to get stuck on.
      const [defaultChannel] = await tx.insert(channels).values({ communityId: created.id, name: "general" }).returning();
      return { community: created, defaultChannelId: defaultChannel.id };
    });
    revalidatePath("/communities");
    return { ...community, defaultChannelId };
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error("That username's taken. Try a different one.");
    throw err;
  }
}

export async function joinCommunity(communityId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to join a community.");

  // Race-safe by construction — the composite PK on communityMembers is the
  // uniqueness guard, no advisory lock needed (unlike startConversation).
  await db.insert(communityMembers).values({ communityId, userId: session.userId }).onConflictDoNothing();
  revalidatePath(COMMUNITY_LAYOUT_PATH, "layout");
  revalidatePath("/communities");
}

export async function leaveCommunity(communityId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const membership = await getMembership(communityId, session.userId);
  if (!membership) return;
  if (membership.role === "owner") {
    throw new Error("Transfer ownership or delete the community before leaving.");
  }

  await db
    .delete(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, session.userId)));
  revalidatePath(COMMUNITY_LAYOUT_PATH, "layout");
  revalidatePath("/communities");
}

const updateCommunitySchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

export async function updateCommunity(communityId: string, input: z.infer<typeof updateCommunitySchema>) {
  await requireCommunityRole(communityId, ["owner", "admin"]);
  const parsed = updateCommunitySchema.parse(input);
  await db.update(communities).set(parsed).where(eq(communities.id, communityId));
  revalidatePath(COMMUNITY_LAYOUT_PATH, "layout");
}

export async function deleteCommunity(communityId: string) {
  await requireCommunityRole(communityId, ["owner"]);
  await db.delete(communities).where(eq(communities.id, communityId));
  revalidatePath("/communities");
}

const sendChannelMessageSchema = z.object({
  channelId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something first.").max(2000, "Messages are capped at 2000 characters."),
  replyToMessageId: z.string().uuid().optional(),
  replyExcerpt: z.string().trim().max(500).optional(),
});

export async function sendChannelMessage(input: z.infer<typeof sendChannelMessageSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to message someone.");
  await checkRateLimit("channel:message:send", session.userId, { limit: 60, window: "10 m" });

  const parsed = sendChannelMessageSchema.parse(input);
  const channel = await getChannel(parsed.channelId);
  if (!channel) throw new Error("Channel not found.");
  const membership = await getMembership(channel.communityId, session.userId);
  if (!membership) throw new Error("You're not a member of this community.");
  if (channel.kind === "channel" && !isCommunityManager(membership.role)) {
    throw new Error("Only admins can post in this channel.");
  }

  // Scoped to this channel so a caller can't quote/leak a message id from a
  // different channel/community they happen to also be a member of.
  let replyTo: { id: string; body: string; senderId: string } | null = null;
  if (parsed.replyToMessageId) {
    const [original] = await db
      .select({ id: channelMessages.id, body: channelMessages.body, senderId: channelMessages.senderId })
      .from(channelMessages)
      .where(and(eq(channelMessages.id, parsed.replyToMessageId), eq(channelMessages.channelId, parsed.channelId)))
      .limit(1);
    if (!original) throw new Error("The message you're replying to could not be found.");
    replyTo = original;
  }

  const [message] = await db
    .insert(channelMessages)
    .values({
      channelId: parsed.channelId,
      senderId: session.userId,
      body: parsed.body,
      replyToMessageId: replyTo?.id,
      replyExcerpt: parsed.replyExcerpt,
    })
    .returning({
      id: channelMessages.id,
      body: channelMessages.body,
      createdAt: channelMessages.createdAt,
      senderId: channelMessages.senderId,
      replyToMessageId: channelMessages.replyToMessageId,
      replyExcerpt: channelMessages.replyExcerpt,
    });

  await publishToChannel(`channel:${parsed.channelId}`, "message", {
    id: message.id,
    body: message.body,
    senderId: message.senderId,
    createdAt: message.createdAt.toISOString(),
    replyToMessageId: message.replyToMessageId,
    replyExcerpt: message.replyExcerpt,
  });

  revalidatePath(COMMUNITY_LAYOUT_PATH, "layout");
  return { ...message, viewCount: 0, replyTo, reactions: [] };
}

export async function toggleChannelMessageReaction(messageId: string, emoji: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to react.");
  if (!isMessageReactionEmoji(emoji)) throw new Error("Unsupported reaction.");

  const [message] = await db
    .select({ channelId: channelMessages.channelId })
    .from(channelMessages)
    .where(eq(channelMessages.id, messageId))
    .limit(1);
  if (!message) throw new Error("Message not found.");

  // Independent of the channel/membership check below, so fire it now and
  // await the result only once it's actually needed.
  const existingReactionPromise = db
    .select()
    .from(channelMessageReactions)
    .where(and(eq(channelMessageReactions.messageId, messageId), eq(channelMessageReactions.userId, session.userId)))
    .limit(1);

  const channel = await getChannel(message.channelId);
  if (!channel) throw new Error("Message not found.");
  const membership = await getMembership(channel.communityId, session.userId);
  if (!membership) throw new Error("You're not a member of this community.");

  const action = await toggleReactionCore({
    emoji,
    findExisting: async () => (await existingReactionPromise)[0],
    remove: () =>
      db.delete(channelMessageReactions).where(and(eq(channelMessageReactions.messageId, messageId), eq(channelMessageReactions.userId, session.userId))),
    upsert: () =>
      db
        .insert(channelMessageReactions)
        .values({ messageId, userId: session.userId, emoji })
        .onConflictDoUpdate({ target: [channelMessageReactions.messageId, channelMessageReactions.userId], set: { emoji } }),
  });

  await publishToChannel(`channel:${message.channelId}`, "reaction", {
    messageId,
    userId: session.userId,
    emoji,
    action,
  });

  return { action, emoji };
}

export async function loadOlderChannelMessages(channelId: string, cursor: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const channel = await getChannel(channelId);
  if (!channel) throw new Error("Channel not found.");
  const membership = await getMembership(channel.communityId, session.userId);
  if (!membership) throw new Error("You're not a member of this community.");

  return listChannelMessages(channelId, channel.kind, cursor);
}

/** Marks `messageIds` as seen by the caller. No-ops outside channel-kind communities. */
export async function viewChannelMessages(channelId: string, messageIds: string[]) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");
  if (messageIds.length === 0) return;

  const channel = await getChannel(channelId);
  if (!channel || channel.kind !== "channel") return;
  const membership = await getMembership(channel.communityId, session.userId);
  if (!membership) return;

  await recordChannelMessageViews(channelId, messageIds, session.userId);
}

export async function markCommunityRead(communityId: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  await db
    .update(communityMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, session.userId)));
}

// Owner-only — prevents admin-to-admin privilege-escalation loops.
export async function promoteMember(communityId: string, userId: string) {
  await requireCommunityRole(communityId, ["owner"]);
  await db
    .update(communityMembers)
    .set({ role: "admin" })
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId), ne(communityMembers.role, "owner")));
  revalidatePath(COMMUNITY_LAYOUT_PATH, "layout");
}

export async function demoteMember(communityId: string, userId: string) {
  await requireCommunityRole(communityId, ["owner"]);
  await db
    .update(communityMembers)
    .set({ role: "member" })
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId), ne(communityMembers.role, "owner")));
  revalidatePath(COMMUNITY_LAYOUT_PATH, "layout");
}

export async function removeMember(communityId: string, userId: string) {
  const { membership: actorMembership } = await requireCommunityRole(communityId, ["owner", "admin"]);
  const target = await getMembership(communityId, userId);
  if (!target) return;
  if (target.role === "owner") throw new Error("The owner can't be removed.");
  if (target.role === "admin" && actorMembership.role !== "owner") {
    throw new Error("Only the owner can remove an admin.");
  }

  await db.delete(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)));
  revalidatePath(COMMUNITY_LAYOUT_PATH, "layout");
}
