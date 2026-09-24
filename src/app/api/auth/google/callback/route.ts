import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeGoogleCode } from "@/lib/auth/google";
import { findOrCreateUserFromProvider, linkProviderToUser, ProviderAlreadyLinkedError } from "@/lib/auth/accounts";
import { createSession, verifySession } from "@/lib/auth/session";
import { GOOGLE_STATE_COOKIE, type OAuthStateCookie } from "@/lib/auth/oauth-state";

function redirectWithError(req: NextRequest, message: string) {
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const rawStateCookie = cookieStore.get(GOOGLE_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_STATE_COOKIE);

  if (!code || !state || !rawStateCookie) {
    return redirectWithError(req, "missing_state");
  }

  let stateCookie: OAuthStateCookie;
  try {
    stateCookie = JSON.parse(rawStateCookie);
  } catch {
    return redirectWithError(req, "invalid_state");
  }

  if (stateCookie.state !== state) {
    return redirectWithError(req, "state_mismatch");
  }

  try {
    const profile = await exchangeGoogleCode(code);

    if (stateCookie.mode === "link") {
      const session = await verifySession();
      if (!session) return redirectWithError(req, "not_authenticated");

      await linkProviderToUser(session.userId, {
        provider: "google",
        providerAccountId: profile.sub,
        displayName: profile.name ?? "Google user",
        usernameSeed: profile.email ?? profile.name ?? "user",
        email: profile.email,
      });

      return NextResponse.redirect(new URL("/settings/connected-accounts", req.nextUrl.origin));
    }

    const userId = await findOrCreateUserFromProvider({
      provider: "google",
      providerAccountId: profile.sub,
      displayName: profile.name ?? "New creator",
      usernameSeed: profile.email ?? profile.name ?? "user",
      avatarUrl: profile.picture,
      email: profile.email,
    });

    await createSession(userId);
    return NextResponse.redirect(new URL("/home", req.nextUrl.origin));
  } catch (error) {
    if (error instanceof ProviderAlreadyLinkedError) {
      return redirectWithError(req, "already_linked");
    }
    console.error("Google auth callback failed", error);
    return redirectWithError(req, "google_auth_failed");
  }
}
