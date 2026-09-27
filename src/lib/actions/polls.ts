"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { messages, channelMessages, messagePolls, messagePollOptions, messagePollVotes } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { isParticipant, getConversationMeta } from "@/lib/data/messages";
import { getMembership, getChannel } from "@/lib/data/communities";
import { publishToChannel } from "@/lib/realtime/ably-server";

/** Finds which surface (DM conversation, or group/channel) owns `pollId`, via whichever message row references it. */
async function findPollOwner(pollId: string): Promise<{ scope: "dm"; conversationId: string } | { scope: "channel"; channelId: string } | null> {
  const [dmRow] = await db.select({ conversationId: messages.conversationId }).from(messages).where(eq(messages.pollId, pollId)).limit(1);
  if (dmRow) return { scope: "dm", conversationId: dmRow.conversationId };

  const [channelRow] = await db.select({ channelId: channelMessages.channelId }).from(channelMessages).where(eq(channelMessages.pollId, pollId)).limit(1);
  if (channelRow) return { scope: "channel", channelId: channelRow.channelId };

  return null;
}

/**
 * Toggles the caller's vote for `optionId`. Clicking an already-picked option
 * unselects it; for a single-choice poll, picking a different option first
 * clears the caller's other vote(s) on the same poll (switching, not adding).
 */
/**
 * `clientId` is a per-tab random id the caller generates once and reuses for
 * every vote — it's echoed back in the realtime broadcast so the originating
 * tab (and only that tab, not every open tab/device for the same account)
 * can skip re-applying its own already-applied optimistic update.
 */
export async function votePoll(pollId: string, optionId: string, clientId?: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");
  await checkRateLimit("poll:vote", session.userId, { limit: 120, window: "10 m" });

  const owner = await findPollOwner(pollId);
  if (!owner) throw new Error("Poll not found.");

  if (owner.scope === "dm") {
    const [participant, meta] = await Promise.all([isParticipant(owner.conversationId, session.userId), getConversationMeta(owner.conversationId)]);
    if (!participant || !meta) throw new Error("Poll not found.");
    // Mirrors sendMessage/createPoll/shareContact — a declined initiator can't
    // put anything new into the conversation, including a vote.
    if (meta.status === "declined" && session.userId === meta.initiatorId) {
      throw new Error("This message request was declined.");
    }
  } else {
    const channel = await getChannel(owner.channelId);
    if (!channel) throw new Error("Poll not found.");
    const membership = await getMembership(channel.communityId, session.userId);
    if (!membership) throw new Error("Poll not found.");
  }

  const [option] = await db
    .select({ id: messagePollOptions.id })
    .from(messagePollOptions)
    .where(and(eq(messagePollOptions.id, optionId), eq(messagePollOptions.pollId, pollId)))
    .limit(1);
  if (!option) throw new Error("That option doesn't exist.");

  // Every branch below determines "did this call actually change a row" from
  // the statement's own `.returning()` rather than a preceding SELECT. The
  // advisory lock (keyed by poll+voter) serializes this same user's
  // concurrent votes on this poll, so a rapid switch between two options
  // under single-choice can't leave both persisted — Postgres's read-committed
  // gap semantics mean two concurrent "delete rows for pollId+userId" against
  // *different* target options wouldn't otherwise conflict at the row level.
  const { added, removed } = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${pollId} || ':' || ${session.userId}, 0))`);

    const [poll] = await tx.select({ allowMultiple: messagePolls.allowMultiple }).from(messagePolls).where(eq(messagePolls.id, pollId)).limit(1);
    if (!poll) throw new Error("Poll not found.");

    const removed: string[] = [];
    const added: string[] = [];

    const deletedSame = await tx
      .delete(messagePollVotes)
      .where(and(eq(messagePollVotes.pollId, pollId), eq(messagePollVotes.optionId, optionId), eq(messagePollVotes.userId, session.userId)))
      .returning({ optionId: messagePollVotes.optionId });

    if (deletedSame.length > 0) {
      removed.push(optionId);
    } else {
      if (!poll.allowMultiple) {
        const deletedOthers = await tx
          .delete(messagePollVotes)
          .where(and(eq(messagePollVotes.pollId, pollId), eq(messagePollVotes.userId, session.userId)))
          .returning({ optionId: messagePollVotes.optionId });
        removed.push(...deletedOthers.map((v) => v.optionId));
      }
      const inserted = await tx
        .insert(messagePollVotes)
        .values({ pollId, optionId, userId: session.userId })
        .onConflictDoNothing()
        .returning({ optionId: messagePollVotes.optionId });
      if (inserted.length > 0) added.push(optionId);
    }

    return { added, removed };
  });

  const channelName = owner.scope === "dm" ? `conversation:${owner.conversationId}` : `channel:${owner.channelId}`;
  await publishToChannel(channelName, "poll-vote", { pollId, userId: session.userId, clientId, added, removed });

  return { added, removed };
}
