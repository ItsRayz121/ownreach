import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/session";
import { assertSameOrigin, getClientIp } from "@/lib/auth/http";
import { checkRateLimitResponse } from "@/lib/ratelimit";
import { createEmailLoginRequest } from "@/lib/auth/email-login";
import { emailSchema } from "@/lib/auth/validation";

// Login/signup now goes through password auth (see lib/actions/auth.ts) — this
// route only backs Settings > Connected Accounts' "verify and link an email
// identity" flow, so `link` is required rather than optional.
const bodySchema = z.object({
  email: emailSchema,
  link: z.literal(true),
});

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const ipLimited = await checkRateLimitResponse("auth:email:start", getClientIp(req), { limit: 10, window: "10 m" });
  if (ipLimited) return ipLimited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const { email, link } = parsed.data;

  // Separate cap keyed by the target address — otherwise an attacker could
  // spread requests across many IPs to spam one inbox with sign-in emails.
  const emailLimited = await checkRateLimitResponse("auth:email:start:target", email, { limit: 5, window: "15 m" });
  if (emailLimited) return emailLimited;

  let linkUserId: string | undefined;
  if (link) {
    const session = await verifySession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    linkUserId = session.userId;
  }

  try {
    await createEmailLoginRequest({ email, mode: link ? "link" : "signin", linkUserId });
  } catch (error) {
    console.error("Email login request failed", error);
    return NextResponse.json({ error: "Couldn't send the sign-in email. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
