/**
 * Shared toggle/upsert-or-delete logic for message reactions — used by both
 * the DM (`actions/messages.ts`) and channel/group (`actions/communities.ts`)
 * reaction actions. Each table's actual queries are injected as closures, so
 * this stays plain TS with no Drizzle-table genericity to fight.
 */
export async function toggleReactionCore(deps: {
  emoji: string;
  findExisting: () => Promise<{ emoji: string } | undefined>;
  remove: () => Promise<unknown>;
  upsert: () => Promise<unknown>;
}): Promise<"added" | "removed"> {
  const existing = await deps.findExisting();
  if (existing && existing.emoji === deps.emoji) {
    await deps.remove();
    return "removed";
  }
  await deps.upsert();
  return "added";
}
