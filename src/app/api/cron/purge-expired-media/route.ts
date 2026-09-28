import { NextRequest, NextResponse } from "next/server";
import { and, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { messageMedia } from "@/db/schema";
import { cloudinary } from "@/lib/cloudinary";

// Capped per invocation so a large backlog can't turn one cron tick into a
// slow, timeout-prone request — any remainder just gets picked up on the
// next scheduled run (see vercel.json's `crons` entry), since the
// `expiresAt < now()` filter only grows more inclusive over time.
const BATCH_SIZE = 200;

/**
 * Hit on a schedule to purge chat images whose per-surface retention window
 * (lib/media-retention.ts) has elapsed — bounds Cloudinary storage/bandwidth
 * instead of keeping every photo ever sent. Soft-deletes each row (clears
 * url/publicId, sets removedAt) rather than hard-deleting it, so the owning
 * message still renders a "photo no longer available" placeholder instead of
 * going blank. No realtime fan-out here (unlike the manual-delete actions) —
 * this runs in the background on a schedule, not in response to a viewer
 * action, so the next fetch/navigation is an acceptable way to pick it up.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await db
    .select({ id: messageMedia.id, publicId: messageMedia.publicId })
    .from(messageMedia)
    .where(and(lt(messageMedia.expiresAt, new Date()), isNull(messageMedia.removedAt)))
    .limit(BATCH_SIZE);

  if (expired.length === 0) return NextResponse.json({ purged: 0 });

  // Only rows whose Cloudinary asset is actually confirmed gone (or never
  // had one) are marked removed — a transient Cloudinary error (rate limit,
  // timeout) must leave its row alone so the next scheduled run retries it,
  // rather than wiping publicId and orphaning the asset with no way back.
  const removableIds: string[] = [];
  await Promise.all(
    expired.map(async (m) => {
      if (!m.publicId) {
        removableIds.push(m.id);
        return;
      }
      try {
        await cloudinary.uploader.destroy(m.publicId);
        removableIds.push(m.id);
      } catch {
        // Left out of removableIds — retried on the next run.
      }
    })
  );

  if (removableIds.length > 0) {
    await db
      .update(messageMedia)
      .set({ removedAt: new Date(), url: null, publicId: null, width: null, height: null })
      .where(inArray(messageMedia.id, removableIds));
  }

  return NextResponse.json({ purged: removableIds.length, failed: expired.length - removableIds.length });
}
