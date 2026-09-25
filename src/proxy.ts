import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const PROTECTED_PREFIXES = ["/home", "/settings", "/bookmarks", "/notifications", "/messages", "/admin", "/communities"];
const AUTH_ONLY_ROUTES = ["/login"];

// Optimistic only: presence of the session cookie, no DB round trip. Real
// verification always happens in the DAL (verifySession) before any data is
// read or written — see docs/app/guides/authentication.md#authorization.
export function proxy(req: NextRequest) {
  const hasSessionCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const path = req.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (isProtected && !hasSessionCookie) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (AUTH_ONLY_ROUTES.includes(path) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/home", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest|icon|apple-icon|sw.js).*)"],
};
