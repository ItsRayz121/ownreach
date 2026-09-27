import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { messagePolls, messagePollOptions, messagePollVotes } from "@/db/schema";

export interface PollOptionSummary {
  id: string;
  text: string;
  voteCount: number;
  votedByMe: boolean;
}

export interface PollSummary {
  id: string;
  question: string;
  allowMultiple: boolean;
  options: PollOptionSummary[];
}

/** Attaches poll question/options/tallies to a page of messages carrying a `pollId`, scoped to `viewerId` for `votedByMe`. */
export async function buildPollMap(rows: { pollId: string | null }[], viewerId: string): Promise<Map<string, PollSummary>> {
  const pollIds = [...new Set(rows.map((r) => r.pollId).filter((id): id is string => Boolean(id)))];
  if (pollIds.length === 0) return new Map();

  const [polls, options, votes] = await Promise.all([
    db
      .select({ id: messagePolls.id, question: messagePolls.question, allowMultiple: messagePolls.allowMultiple })
      .from(messagePolls)
      .where(inArray(messagePolls.id, pollIds)),
    db
      .select({ id: messagePollOptions.id, pollId: messagePollOptions.pollId, text: messagePollOptions.text })
      .from(messagePollOptions)
      .where(inArray(messagePollOptions.pollId, pollIds))
      .orderBy(messagePollOptions.position),
    db
      .select({ optionId: messagePollVotes.optionId, pollId: messagePollVotes.pollId, userId: messagePollVotes.userId })
      .from(messagePollVotes)
      .where(inArray(messagePollVotes.pollId, pollIds)),
  ]);

  const votersByOption = new Map<string, string[]>();
  for (const v of votes) {
    const list = votersByOption.get(v.optionId) ?? [];
    list.push(v.userId);
    votersByOption.set(v.optionId, list);
  }

  const optionsByPoll = new Map<string, PollOptionSummary[]>();
  for (const o of options) {
    const voters = votersByOption.get(o.id) ?? [];
    const list = optionsByPoll.get(o.pollId) ?? [];
    list.push({ id: o.id, text: o.text, voteCount: voters.length, votedByMe: voters.includes(viewerId) });
    optionsByPoll.set(o.pollId, list);
  }

  return new Map(
    polls.map((p) => [p.id, { id: p.id, question: p.question, allowMultiple: p.allowMultiple, options: optionsByPoll.get(p.id) ?? [] }])
  );
}
