import "server-only";
import { randomBytes } from "crypto";
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetRequests } from "@/db/schema";
import { sendEmail } from "@/lib/mail/resend";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

function resetEmailHtml(link: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <p>We got a request to reset your OwnReach password. This link expires in 30 minutes and works once.</p>
      <p>
        <a href="${link}" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
          Reset your password
        </a>
      </p>
      <p style="color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    </div>
  `;
}

export async function createPasswordResetRequest(userId: string, email: string) {
  // Opportunistic cleanup — mirrors emailLoginRequests; this table only ever
  // holds a handful of short-lived rows, so a periodic job is overkill.
  await db.delete(passwordResetRequests).where(lt(passwordResetRequests.expiresAt, new Date()));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await db.insert(passwordResetRequests).values({ token, userId, expiresAt });

  const resetUrl = new URL("/login/reset-password", process.env.NEXT_PUBLIC_APP_URL);
  resetUrl.searchParams.set("token", token);

  await sendEmail({
    to: email,
    subject: "Reset your OwnReach password",
    html: resetEmailHtml(resetUrl.toString()),
  });
}
