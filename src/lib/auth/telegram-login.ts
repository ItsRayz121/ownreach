import "server-only";
import { eq, and, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { telegramLoginRequests, type TelegramProfile } from "@/db/schema";

interface CreateTelegramLoginRequestArgs {
  token: string;
  mode: "signin" | "link";
  linkUserId: string | null;
  expiresAt: Date;
}

// Opportunistic cleanup — this table only ever holds a handful of
// short-lived rows, so a periodic job would be overkill.
export async function deleteExpiredTelegramLoginRequests() {
  await db.delete(telegramLoginRequests).where(lt(telegramLoginRequests.expiresAt, new Date()));
}

export async function createTelegramLoginRequest({ token, mode, linkUserId, expiresAt }: CreateTelegramLoginRequestArgs) {
  await db.insert(telegramLoginRequests).values({ token, mode, linkUserId, expiresAt });
}

export async function getTelegramLoginRequest(token: string) {
  const [request] = await db
    .select()
    .from(telegramLoginRequests)
    .where(eq(telegramLoginRequests.token, token))
    .limit(1);
  return request ?? null;
}

// Atomically claim the confirmed row so a duplicate/retried poll (two tabs,
// a flaky connection retrying) can never create a second session from the
// same Telegram confirmation.
export async function claimConfirmedTelegramLoginRequest(token: string) {
  const [claimed] = await db
    .delete(telegramLoginRequests)
    .where(and(eq(telegramLoginRequests.token, token), eq(telegramLoginRequests.status, "confirmed")))
    .returning();
  return claimed ?? null;
}

export async function confirmTelegramLoginRequest(token: string, profile: TelegramProfile) {
  const [claimed] = await db
    .update(telegramLoginRequests)
    .set({ status: "confirmed", telegramProfile: profile })
    .where(
      and(
        eq(telegramLoginRequests.token, token),
        eq(telegramLoginRequests.status, "pending"),
        gt(telegramLoginRequests.expiresAt, new Date())
      )
    )
    .returning();
  return claimed ?? null;
}
