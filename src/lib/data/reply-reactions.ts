/**
 * Shared shape-building helpers for "attach replies/reactions to a page of
 * messages," used by both the DM (`messages.ts`) and channel/group
 * (`communities.ts`) data layers. Each table's actual query is injected as a
 * small closure — kept out of here — so this stays plain TS with no
 * Drizzle-table genericity to fight.
 */

interface ReplySource {
  id: string;
  body: string;
  senderId: string;
}

/** Dedupes `replyToMessageId`s, fetches the originals via `fetchOriginals`, and builds an id->original map. */
export async function buildReplyMap<T extends ReplySource>(
  rows: { replyToMessageId: string | null }[],
  fetchOriginals: (ids: string[]) => Promise<T[]>
): Promise<Map<string, T>> {
  const replyIds = [...new Set(rows.map((r) => r.replyToMessageId).filter((id): id is string => Boolean(id)))];
  if (replyIds.length === 0) return new Map();

  const originals = await fetchOriginals(replyIds);
  return new Map(originals.map((o) => [o.id, o]));
}

interface ReactionRow {
  messageId: string;
  emoji: string;
  userId: string;
}

/** Fetches reaction rows for `messageIds` via `fetchRows` and groups them by messageId. */
export async function buildReactionMap<R extends ReactionRow>(
  messageIds: string[],
  fetchRows: (ids: string[]) => Promise<R[]>
): Promise<Map<string, { emoji: string; userId: string }[]>> {
  if (messageIds.length === 0) return new Map();
  const rows = await fetchRows(messageIds);

  const map = new Map<string, { emoji: string; userId: string }[]>();
  for (const row of rows) {
    const list = map.get(row.messageId) ?? [];
    list.push({ emoji: row.emoji, userId: row.userId });
    map.set(row.messageId, list);
  }
  return map;
}
