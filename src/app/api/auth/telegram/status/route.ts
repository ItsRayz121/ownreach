import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { telegramLoginRequests } from "@/db/schema";
import { findOrCreateUserFromProvider, linkProviderToUser, ProviderAlreadyLinkedError } from "@/lib/auth/accounts";
import { createSession, verifySession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/http";
import { TELEGRAM_LOGIN_COOKIE } from "@/lib/auth/constants";

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const cookieStore = await cookies();
  const token = cookieStore.get(TELEGRAM_LOGIN_COOKIE)?.value;
  if (!token) return NextResponse.json({ status: "expired" });

  const [request] = await db
    .select()
    .from(telegramLoginRequests)
    .where(eq(telegramLoginRequests.token, token))
    .limit(1);

  if (!request || request.expiresAt < new Date()) {
    cookieStore.delete(TELEGRAM_LOGIN_COOKIE);
    return NextResponse.json({ status: "expired" });
  }

  if (request.status === "pending") {
    return NextResponse.json({ status: "pending" });
  }

  // Atomically claim the confirmed row so a duplicate/retried poll (two tabs,
  // a flaky connection retrying) can never create a second session from the
  // same Telegram confirmation.
  const [claimed] = await db
    .delete(telegramLoginRequests)
    .where(and(eq(telegramLoginRequests.token, token), eq(telegramLoginRequests.status, "confirmed")))
    .returning();

  cookieStore.delete(TELEGRAM_LOGIN_COOKIE);

  if (!claimed || !claimed.telegramProfile) {
    return NextResponse.json({ status: "expired" });
  }

  const profile = claimed.telegramProfile;
  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Telegram user";
  const usernameSeed = profile.username ?? displayName;

  try {
    if (claimed.mode === "link") {
      const session = await verifySession();
      if (!session || session.userId !== claimed.linkUserId) {
        return NextResponse.json({ status: "error", error: "Not authenticated" });
      }

      await linkProviderToUser(session.userId, {
        provider: "telegram",
        providerAccountId: profile.id,
        displayName,
        usernameSeed,
        metadata: { username: profile.username },
      });
      return NextResponse.json({ status: "done", redirect: "/settings/connected-accounts" });
    }

    const userId = await findOrCreateUserFromProvider({
      provider: "telegram",
      providerAccountId: profile.id,
      displayName,
      usernameSeed,
      metadata: { username: profile.username },
    });

    await createSession(userId);
    return NextResponse.json({ status: "done", redirect: "/home" });
  } catch (error) {
    if (error instanceof ProviderAlreadyLinkedError) {
      return NextResponse.json({ status: "error", error: error.message });
    }
    console.error("Telegram login finalize failed", error);
    return NextResponse.json({ status: "error", error: "Authentication failed" });
  }
}
