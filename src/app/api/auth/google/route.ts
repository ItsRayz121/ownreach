import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { buildGoogleAuthUrl } from "@/lib/auth/google";
import { verifySession } from "@/lib/auth/session";
import { GOOGLE_STATE_COOKIE, type OAuthStateCookie } from "@/lib/auth/oauth-state";

export async function GET(req: NextRequest) {
  const wantsLink = req.nextUrl.searchParams.get("link") === "1";
  const session = wantsLink ? await verifySession() : null;
  const mode: OAuthStateCookie["mode"] = wantsLink && session ? "link" : "signin";

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, mode } satisfies OAuthStateCookie), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
