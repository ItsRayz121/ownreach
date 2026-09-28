import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { messageMedia } from "@/db/schema";

export interface MediaSummary {
  url: string | null;
  width: number | null;
  height: number | null;
  /** True once the retention cron or a manual delete has purged the asset — `url` is null in that case. */
  removed: boolean;
}

/** Attaches the image (or a "removed" marker) to a page of messages carrying a `mediaId`. */
export async function buildMediaMap(rows: { mediaId: string | null }[]): Promise<Map<string, MediaSummary>> {
  const ids = [...new Set(rows.map((r) => r.mediaId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const rowsOut = await db
    .select({
      id: messageMedia.id,
      url: messageMedia.url,
      width: messageMedia.width,
      height: messageMedia.height,
      removedAt: messageMedia.removedAt,
    })
    .from(messageMedia)
    .where(inArray(messageMedia.id, ids));

  return new Map(
    rowsOut.map((r) => [
      r.id,
      {
        url: r.removedAt ? null : r.url,
        width: r.removedAt ? null : r.width,
        height: r.removedAt ? null : r.height,
        removed: Boolean(r.removedAt),
      },
    ])
  );
}
