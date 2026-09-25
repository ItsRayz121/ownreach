import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { emailLoginRequests } from "@/db/schema";
import { linkProviderToUser, ProviderAlreadyLinkedError } from "@/lib/auth/accounts";
import { verifySession } from "@/lib/auth/session";

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
    // Login/signup now goes through password auth — this route only ever
    // handles linking an email to an already-authenticated session.
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
  } catch (error) {
    if (error instanceof ProviderAlreadyLinkedError) {
      return redirectWithError(req, "already_linked");
    }
    console.error("Email login verify failed", error);
    return redirectWithError(req, "email_auth_failed");
  }
}
