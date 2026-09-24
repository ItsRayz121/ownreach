import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyTelegramLogin } from "@/lib/auth/telegram";
import { findOrCreateUserFromProvider, linkProviderToUser, ProviderAlreadyLinkedError } from "@/lib/auth/accounts";
import { createSession, verifySession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/http";

const bodySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.union([z.string(), z.number()]).transform(String),
  hash: z.string(),
  link: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { link, ...payload } = parsed.data;

  if (!verifyTelegramLogin(payload)) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  const displayName = [payload.first_name, payload.last_name].filter(Boolean).join(" ") || "Telegram user";
  const usernameSeed = payload.username ?? displayName;

  try {
    if (link) {
      const session = await verifySession();
      if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

      await linkProviderToUser(session.userId, {
        provider: "telegram",
        providerAccountId: payload.id,
        displayName,
        usernameSeed,
        avatarUrl: payload.photo_url,
        metadata: { username: payload.username },
      });
      return NextResponse.json({ ok: true, redirect: "/settings/connected-accounts" });
    }

    const userId = await findOrCreateUserFromProvider({
      provider: "telegram",
      providerAccountId: payload.id,
      displayName,
      usernameSeed,
      avatarUrl: payload.photo_url,
      metadata: { username: payload.username },
    });

    await createSession(userId);
    return NextResponse.json({ ok: true, redirect: "/home" });
  } catch (error) {
    if (error instanceof ProviderAlreadyLinkedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Telegram auth failed", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
