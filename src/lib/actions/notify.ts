import "server-only";
import { after } from "next/server";
import { db } from "@/db";
import { notifications, type NewNotification } from "@/db/schema";
import { publishToChannel } from "@/lib/realtime/ably-server";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface NotifyTarget {
  recipientId: string;
  type: NewNotification["type"];
}

/** Inserts notification rows via the caller's db client or transaction. */
export async function insertNotifications(client: DbOrTx, rows: NewNotification[]) {
  if (rows.length === 0) return;
  await client.insert(notifications).values(rows);
}

/**
 * Schedules realtime "new notification" fan-out to run after the response is
 * sent (via Next's `after`), so a slow or failing publish never delays the
 * caller — while still running to completion, unlike a bare unawaited
 * promise that a serverless invocation could freeze mid-flight.
 */
export function scheduleNotificationPublish(targets: NotifyTarget[]) {
  if (targets.length === 0) return;
  after(() =>
    Promise.all(targets.map((t) => publishToChannel(`user:${t.recipientId}:notifications`, "new", { type: t.type })))
  );
}
