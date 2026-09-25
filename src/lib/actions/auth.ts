"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { authAccounts, passwordResetRequests, profiles, users } from "@/db/schema";
import { destroySession, createSession, destroyAllSessionsForUser, verifySession } from "@/lib/auth/session";
import { generateUniqueUsername } from "@/lib/auth/accounts";
import { hashPassword, verifyPassword, passwordSchema, getDummyPasswordHash } from "@/lib/auth/password";
import { emailSchema } from "@/lib/auth/validation";
import { createPasswordResetRequest } from "@/lib/auth/password-reset";
import { getClientIpFromHeaders } from "@/lib/auth/http";
import { checkRateLimit, RateLimitError } from "@/lib/ratelimit";
import { isUniqueViolation } from "@/lib/db-errors";

export async function logout() {
  await destroySession();
  redirect("/login");
}

type ActionResult = { ok: true } | { ok: false; error: string };

const ALREADY_REGISTERED = "That email is already registered. Try logging in, or use ‘Forgot password’.";
const GENERIC_LOGIN_ERROR = "Incorrect email or password.";

export async function signupWithPassword(input: { email: string; password: string }): Promise<ActionResult> {
  const parsed = z.object({ email: emailSchema, password: passwordSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { email, password } = parsed.data;

  const ip = await getClientIpFromHeaders();
  try {
    await Promise.all([
      checkRateLimit("auth:password:signup:ip", ip, { limit: 10, window: "10 m" }),
      checkRateLimit("auth:password:signup:email", email, { limit: 5, window: "60 m" }),
    ]);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const [existing] = await db
    .select({ id: authAccounts.id })
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, "password"), eq(authAccounts.providerAccountId, email)))
    .limit(1);
  if (existing) return { ok: false, error: ALREADY_REGISTERED };

  const passwordHash = await hashPassword(password);
  const displayName = email.split("@")[0] || "New creator";
  const username = await generateUniqueUsername(email);

  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email }).returning({ id: users.id });
      await tx.insert(profiles).values({ userId: user.id, username, displayName });
      await tx.insert(authAccounts).values({
        userId: user.id,
        provider: "password",
        providerAccountId: email,
        passwordHash,
      });
      return user.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: ALREADY_REGISTERED };
    console.error("Signup failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  await createSession(userId);
  redirect("/home");
}

export async function loginWithPassword(input: { email: string; password: string }): Promise<ActionResult> {
  const parsed = z.object({ email: emailSchema, password: z.string().min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email and password." };
  const { email, password } = parsed.data;

  const ip = await getClientIpFromHeaders();
  try {
    await Promise.all([
      checkRateLimit("auth:password:login:ip", ip, { limit: 10, window: "10 m" }),
      checkRateLimit("auth:password:login:email", email, { limit: 5, window: "15 m" }),
    ]);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const [account] = await db
    .select()
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, "password"), eq(authAccounts.providerAccountId, email)))
    .limit(1);

  if (!account?.passwordHash) {
    await verifyPassword(password, await getDummyPasswordHash()); // decoy: equalize timing with the "wrong password" branch
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) return { ok: false, error: GENERIC_LOGIN_ERROR };

  const [user] = await db.select({ status: users.status }).from(users).where(eq(users.id, account.userId)).limit(1);
  if (!user || user.status === "suspended") return { ok: false, error: GENERIC_LOGIN_ERROR };

  await createSession(account.userId);
  redirect("/home");
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = z.object({ email: emailSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const { email } = parsed.data;

  const ip = await getClientIpFromHeaders();
  try {
    await Promise.all([
      checkRateLimit("auth:password:reset:ip", ip, { limit: 5, window: "10 m" }),
      checkRateLimit("auth:password:reset:email", email, { limit: 3, window: "30 m" }),
    ]);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }

  const [account] = await db
    .select({ userId: authAccounts.userId })
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, "password"), eq(authAccounts.providerAccountId, email)))
    .limit(1);

  if (account) {
    try {
      await createPasswordResetRequest(account.userId, email);
    } catch (err) {
      console.error("Password reset email failed", err);
    }
  }
  // Always the same response, whether or not an account exists — anti-enumeration.
  return { ok: true };
}

export async function resetPassword(input: { token: string; password: string }): Promise<ActionResult> {
  const parsed = z.object({ token: z.string().min(1), password: passwordSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const { token, password } = parsed.data;

  // Hash first (pure CPU, can't fail the DB) so the token claim and the
  // password update below can be a single atomic transaction — otherwise a
  // failure between the two would burn a single-use token without ever
  // changing the password, locking the user out until they request a new link.
  const passwordHash = await hashPassword(password);

  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(passwordResetRequests)
      .where(and(eq(passwordResetRequests.token, token), gt(passwordResetRequests.expiresAt, new Date())))
      .returning();
    if (!row) return null;

    await tx
      .update(authAccounts)
      .set({ passwordHash })
      .where(and(eq(authAccounts.provider, "password"), eq(authAccounts.userId, row.userId)));
    return row;
  });
  if (!claimed) return { ok: false, error: "That reset link is invalid or has expired. Request a new one." };

  await destroyAllSessionsForUser(claimed.userId);
  await createSession(claimed.userId);
  redirect("/home");
}

/** For OAuth/Telegram/wallet-only accounts adding password sign-in for the first time. */
export async function setPassword(input: { email: string; password: string }): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return { ok: false, error: "You must be signed in." };

  const parsed = z.object({ email: emailSchema, password: passwordSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { email, password } = parsed.data;

  const [existing] = await db
    .select({ id: authAccounts.id })
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, "password"), eq(authAccounts.userId, session.userId)))
    .limit(1);
  if (existing) return { ok: false, error: "This account already has a password. Use “Change password” instead." };

  const passwordHash = await hashPassword(password);
  try {
    await db.insert(authAccounts).values({
      userId: session.userId,
      provider: "password",
      providerAccountId: email,
      passwordHash,
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: ALREADY_REGISTERED };
    throw err;
  }

  // Backfills users.email for an account that signed up via a provider that
  // never collected one (e.g. wallet, Telegram) — doesn't overwrite an
  // existing address.
  await db.update(users).set({ email }).where(and(eq(users.id, session.userId), isNull(users.email)));

  revalidatePath("/settings/connected-accounts");
  return { ok: true };
}

export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return { ok: false, error: "You must be signed in." };

  const parsed = z
    .object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { currentPassword, newPassword } = parsed.data;

  const [account] = await db
    .select()
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, "password"), eq(authAccounts.userId, session.userId)))
    .limit(1);
  if (!account?.passwordHash) return { ok: false, error: "No password is set on this account yet." };

  const valid = await verifyPassword(currentPassword, account.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const passwordHash = await hashPassword(newPassword);
  await db.update(authAccounts).set({ passwordHash }).where(eq(authAccounts.id, account.id));

  await destroyAllSessionsForUser(session.userId);
  await createSession(session.userId);

  revalidatePath("/settings/connected-accounts");
  return { ok: true };
}
