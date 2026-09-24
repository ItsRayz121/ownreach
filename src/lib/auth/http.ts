import "server-only";
import { NextRequest, NextResponse } from "next/server";

/**
 * Minimal CSRF defense for same-origin POST endpoints that aren't behind a
 * <form> (so no Auth.js-style CSRF token exists): reject cross-origin
 * requests outright rather than trusting SameSite cookies alone.
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !appUrl || new URL(origin).host !== new URL(appUrl).host) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  return null;
}
