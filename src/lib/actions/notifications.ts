"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";

export async function markNotificationRead(id: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, session.userId)));

  revalidatePath("/notifications");
}
