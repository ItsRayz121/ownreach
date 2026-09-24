import { NextRequest, NextResponse } from "next/server";

// One-off ops utility: lets us (re-)register this bot's webhook from a
// network that can actually reach api.telegram.org, since Telegram's domains
// are blocked on some networks we develop from. The `url` we register is
// always our own NEXT_PUBLIC_APP_URL — never caller-supplied — so knowing
// TELEGRAM_WEBHOOK_SECRET only lets you point the bot's webhook back at
// ourselves, not anywhere else.
export async function GET(req: NextRequest) {
  const providedSecret = req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!botToken || !appUrl) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN or NEXT_PUBLIC_APP_URL is not set" }, { status: 500 });
  }

  const wantsInfo = req.nextUrl.searchParams.get("action") === "info";
  const telegramUrl = new URL(`https://api.telegram.org/bot${botToken}/${wantsInfo ? "getWebhookInfo" : "setWebhook"}`);
  if (!wantsInfo) {
    telegramUrl.searchParams.set("url", `${appUrl}/api/telegram/webhook`);
    telegramUrl.searchParams.set("secret_token", expectedSecret);
  }

  const res = await fetch(telegramUrl, { signal: AbortSignal.timeout(10_000) });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
