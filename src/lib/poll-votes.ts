export interface PollVoteHolder {
  poll?: { id: string; options: { id: string; voteCount: number; votedByMe: boolean }[] } | null;
}

/**
 * Applies a poll vote add/remove event to a message list's embedded poll
 * tallies — shared between the local optimistic update and the realtime
 * "poll-vote" event. `votedByMe` only changes when `event.userId ===
 * event.viewerId`; the caller is responsible for not re-applying a realtime
 * echo of the viewer's own vote on top of its already-applied optimistic
 * update (voteCount deltas aren't idempotent to reapply, unlike reactions).
 */
export function applyPollVoteEvent<T extends PollVoteHolder>(
  list: T[],
  event: { pollId: string; userId: string; viewerId: string; added: string[]; removed: string[] }
): T[] {
  const isViewer = event.userId === event.viewerId;
  return list.map((m) => {
    if (!m.poll || m.poll.id !== event.pollId) return m;
    return {
      ...m,
      poll: {
        ...m.poll,
        options: m.poll.options.map((o) => {
          let voteCount = o.voteCount;
          let votedByMe = o.votedByMe;
          if (event.added.includes(o.id)) {
            voteCount += 1;
            if (isViewer) votedByMe = true;
          }
          if (event.removed.includes(o.id)) {
            voteCount = Math.max(0, voteCount - 1);
            if (isViewer) votedByMe = false;
          }
          return { ...o, voteCount, votedByMe };
        }),
      },
    } as T;
  });
}
