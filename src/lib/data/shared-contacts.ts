import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

export interface SharedContactSummary {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Attaches the shared profile card to a page of messages carrying a `sharedContactId`. */
export async function buildContactMap(rows: { sharedContactId: string | null }[]): Promise<Map<string, SharedContactSummary>> {
  const ids = [...new Set(rows.map((r) => r.sharedContactId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const rowsOut = await db
    .select({ userId: profiles.userId, username: profiles.username, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(inArray(profiles.userId, ids));
  return new Map(rowsOut.map((r) => [r.userId, r]));
}
