import "server-only";
import { randomBytes } from "crypto";
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { emailLoginRequests } from "@/db/schema";
import { sendEmail } from "@/lib/mail/resend";

export const EMAIL_LOGIN_TTL_MS = 15 * 60 * 1000;

function emailHtml(link: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <p>Click below to sign in to OwnReach. This link expires in 15 minutes and works once.</p>
      <p>
        <a href="${link}" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
          Sign in to OwnReach
        </a>
      </p>
      <p style="color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

export async function createEmailLoginRequest({
  email,
  mode,
  linkUserId,
}: {
  email: string;
  mode: "signin" | "link";
  linkUserId?: string;
}) {
  // Opportunistic cleanup — mirrors telegramLoginRequests; this table only
  // ever holds a handful of short-lived rows, so a periodic job is overkill.
  await db.delete(emailLoginRequests).where(lt(emailLoginRequests.expiresAt, new Date()));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + EMAIL_LOGIN_TTL_MS);

  await db.insert(emailLoginRequests).values({ token, email, mode, linkUserId, expiresAt });

  const verifyUrl = new URL("/api/auth/email/verify", process.env.NEXT_PUBLIC_APP_URL);
  verifyUrl.searchParams.set("token", token);

  await sendEmail({
    to: email,
    subject: "Sign in to OwnReach",
    html: emailHtml(verifyUrl.toString()),
  });
}
