import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { emailLoginRequests } from "@/db/schema";
import { findOrCreateUserFromProvider, linkProviderToUser, ProviderAlreadyLinkedError } from "@/lib/auth/accounts";
import { createSession, verifySession } from "@/lib/auth/session";

function redirectWithError(req: NextRequest, message: string) {
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return redirectWithError(req, "email_link_invalid");

  // Atomically claim: clicking the link both confirms and completes the sign
  // in, so a re-click, prefetch, or duplicate request can never consume it twice.
  const [claimed] = await db
    .delete(emailLoginRequests)
    .where(and(eq(emailLoginRequests.token, token), gt(emailLoginRequests.expiresAt, new Date())))
    .returning();

  if (!claimed) return redirectWithError(req, "email_link_expired");

  const displayName = claimed.email.split("@")[0] ?? "New creator";

  try {
    if (claimed.mode === "link") {
      const session = await verifySession();
      if (!session || session.userId !== claimed.linkUserId) {
        return redirectWithError(req, "not_authenticated");
      }

      await linkProviderToUser(session.userId, {
        provider: "email",
        providerAccountId: claimed.email,
        displayName,
        usernameSeed: claimed.email,
        email: claimed.email,
      });

      return NextResponse.redirect(new URL("/settings/connected-accounts", req.nextUrl.origin));
    }

    const userId = await findOrCreateUserFromProvider({
      provider: "email",
      providerAccountId: claimed.email,
      displayName,
      usernameSeed: claimed.email,
      email: claimed.email,
    });

    await createSession(userId);
    return NextResponse.redirect(new URL("/home", req.nextUrl.origin));
  } catch (error) {
    if (error instanceof ProviderAlreadyLinkedError) {
      return redirectWithError(req, "already_linked");
    }
    console.error("Email login verify failed", error);
    return redirectWithError(req, "email_auth_failed");
  }
}
