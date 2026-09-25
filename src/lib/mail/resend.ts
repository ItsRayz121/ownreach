import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Required for the passwordless email sign-in feature specifically — unlike
 * Ably/Upstash, there's no graceful no-op here: sending the email *is* the
 * feature, so an unconfigured key surfaces as a clear error to the caller
 * rather than silently doing nothing.
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Email sign-in isn't configured yet — set RESEND_API_KEY and EMAIL_FROM.");
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to send email (${res.status}): ${body}`);
  }
}
