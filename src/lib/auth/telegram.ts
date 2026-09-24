import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";

export interface TelegramLoginPayload {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

/**
 * Verifies the Telegram Login Widget payload per Telegram's documented
 * algorithm: HMAC-SHA256 of the sorted "key=value" fields (excluding `hash`),
 * keyed by SHA256(bot_token). This only proves *identity* — it never grants
 * access to the user's Telegram contacts, chats, or session.
 */
export function verifyTelegramLogin(payload: TelegramLoginPayload): boolean {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  const { hash, ...rest } = payload;
  const dataCheckString = Object.entries(rest)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const authDate = Number(payload.auth_date);
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) {
    return false;
  }

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
