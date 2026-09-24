import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { telegramLoginRequests } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { assertSameOrigin, getClientIp } from "@/lib/auth/http";
import { TELEGRAM_LOGIN_COOKIE } from "@/lib/auth/constants";
import { buildTelegramLoginDeepLink, TELEGRAM_LOGIN_TTL_MS } from "@/lib/telegram/bot";
import { checkRateLimitResponse } from "@/lib/ratelimit";

const bodySchema = z.object({ link: z.boolean().optional() });

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const rateLimited = await checkRateLimitResponse("auth:telegram:start", getClientIp(req), { limit: 10, window: "10 m" });
  if (rateLimited) return rateLimited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { link } = parsed.data;

  let linkUserId: string | null = null;
  if (link) {
    const session = await verifySession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    linkUserId = session.userId;
  }

  // Opportunistic cleanup — this table only ever holds a handful of
  // short-lived rows, so a periodic job would be overkill.
  await db.delete(telegramLoginRequests).where(lt(telegramLoginRequests.expiresAt, new Date()));

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TELEGRAM_LOGIN_TTL_MS);

  await db.insert(telegramLoginRequests).values({
    token,
    mode: link ? "link" : "signin",
    linkUserId,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(TELEGRAM_LOGIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TELEGRAM_LOGIN_TTL_MS / 1000,
  });

  return NextResponse.json({ deepLink: buildTelegramLoginDeepLink(token) });
}
