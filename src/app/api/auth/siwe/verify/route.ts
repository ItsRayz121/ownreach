import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySiwe } from "@/lib/auth/siwe";
import { findOrCreateUserFromProvider, linkProviderToUser, ProviderAlreadyLinkedError } from "@/lib/auth/accounts";
import { createSession, verifySession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/http";

const bodySchema = z.object({
  message: z.string(),
  signature: z.string(),
  link: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const address = await verifySiwe(parsed.data);
    const shortAddress = `${address.slice(0, 6)}…${address.slice(-4)}`;

    if (parsed.data.link) {
      const session = await verifySession();
      if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

      await linkProviderToUser(session.userId, {
        provider: "wallet",
        providerAccountId: address.toLowerCase(),
        displayName: shortAddress,
        usernameSeed: shortAddress,
        metadata: { address },
      });
      return NextResponse.json({ ok: true, redirect: "/settings/connected-accounts" });
    }

    const userId = await findOrCreateUserFromProvider({
      provider: "wallet",
      providerAccountId: address.toLowerCase(),
      displayName: shortAddress,
      usernameSeed: shortAddress,
      metadata: { address },
    });

    await createSession(userId);
    return NextResponse.json({ ok: true, redirect: "/home" });
  } catch (error) {
    if (error instanceof ProviderAlreadyLinkedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("SIWE verify failed", error);
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }
}
