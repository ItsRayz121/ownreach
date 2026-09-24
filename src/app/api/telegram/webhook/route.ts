import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { telegramLoginRequests } from "@/db/schema";
import { sendTelegramMessage, TELEGRAM_START_PREFIX } from "@/lib/telegram/bot";

const updateSchema = z.object({
  message: z
    .object({
      text: z.string().optional(),
      chat: z.object({ id: z.number() }),
      from: z.object({
        id: z.number(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        username: z.string().optional(),
      }),
    })
    .optional(),
});

// The single entry point for updates from our existing @ownreach_bot. If
// other bot features are added later, dispatch on message.text here rather
// than adding a second webhook route — Telegram only allows one per bot.
export async function POST(req: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const providedSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  const message = parsed.success ? parsed.data.message : undefined;
  const text = message?.text ?? "";

  if (message && text.startsWith(`/start ${TELEGRAM_START_PREFIX}`)) {
    const token = text.slice(`/start ${TELEGRAM_START_PREFIX}`.length).trim();

    const [claimed] = await db
      .update(telegramLoginRequests)
      .set({
        status: "confirmed",
        telegramProfile: {
          id: String(message.from.id),
          first_name: message.from.first_name,
          last_name: message.from.last_name,
          username: message.from.username,
        },
      })
      .where(
        and(
          eq(telegramLoginRequests.token, token),
          eq(telegramLoginRequests.status, "pending"),
          gt(telegramLoginRequests.expiresAt, new Date())
        )
      )
      .returning();

    // Fire-and-forget: Telegram expects a fast webhook response and retries
    // on timeout, so a slow/unreachable sendMessage call must not hold this up.
    void sendTelegramMessage(
      message.chat.id,
      claimed
        ? "You're confirmed. Go back to OwnReach in your browser to finish signing in."
        : "That login link expired or was already used. Go back to OwnReach and tap “Login with Telegram” again."
    );
  }

  return NextResponse.json({ ok: true });
}
