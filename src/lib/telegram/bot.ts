import "server-only";

export const TELEGRAM_LOGIN_TTL_MS = 5 * 60 * 1000;
export const TELEGRAM_START_PREFIX = "login_";

function requireEnv(name: "TELEGRAM_BOT_TOKEN" | "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function buildTelegramLoginDeepLink(token: string) {
  const botUsername = requireEnv("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME");
  return `https://t.me/${botUsername}?start=${TELEGRAM_START_PREFIX}${token}`;
}

export async function sendTelegramMessage(chatId: number | string, text: string) {
  const botToken = requireEnv("TELEGRAM_BOT_TOKEN");
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("Failed to send Telegram message", error);
  }
}
