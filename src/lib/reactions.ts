export const MESSAGE_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export type MessageReactionEmoji = (typeof MESSAGE_REACTION_EMOJIS)[number];

export function isMessageReactionEmoji(value: string): value is MessageReactionEmoji {
  return (MESSAGE_REACTION_EMOJIS as readonly string[]).includes(value);
}

export interface ReactableItem {
  id: string;
  reactions: { emoji: string; userId: string }[];
}

/**
 * Applies a reaction add/remove event to a message list — shared between DM
 * and channel/group threads (both realtime "reaction" events and the local
 * optimistic update/rollback use this). Idempotent: re-applying the same
 * event is a no-op, since it always sets the target user's entry from
 * scratch rather than toggling.
 */
export function applyReactionEvent<T extends ReactableItem>(
  list: T[],
  event: { messageId: string; userId: string; emoji: string; action: "added" | "removed" }
): T[] {
  return list.map((m) => {
    if (m.id !== event.messageId) return m;
    const withoutUser = m.reactions.filter((r) => r.userId !== event.userId);
    return {
      ...m,
      reactions: event.action === "added" ? [...withoutUser, { emoji: event.emoji, userId: event.userId }] : withoutUser,
    } as T;
  });
}
