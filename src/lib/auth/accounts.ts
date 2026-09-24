import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, authAccounts, profiles, type AuthAccount } from "@/db/schema";

type Provider = AuthAccount["provider"];

// These collide with static route segments (/home, /login, …) or read as
// impersonation risks — never hand them out as a generated username.
const RESERVED_USERNAMES = new Set([
  "home",
  "explore",
  "login",
  "logout",
  "settings",
  "post",
  "api",
  "admin",
  "channel",
  "channels",
  "group",
  "groups",
  "messages",
  "notifications",
  "bookmarks",
  "ownreach",
  "support",
  "about",
  "help",
  "user",
]);

async function generateUniqueUsername(seed: string) {
  const base =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "user";

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate =
      attempt === 0 && !RESERVED_USERNAMES.has(base) ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const [existing] = await db
      .select({ username: profiles.username })
      .from(profiles)
      .where(eq(profiles.username, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `${base}${Date.now()}`;
}

interface IdentitySeed {
  provider: Provider;
  providerAccountId: string;
  displayName: string;
  usernameSeed: string;
  avatarUrl?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Looks up the (provider, providerAccountId) pair. If it already belongs to a
 * user, signs that user in. Otherwise creates a brand-new user + profile —
 * sign-ins never silently merge across providers by email, since that would
 * let an attacker who controls a second provider hijack an existing account.
 * Explicit linking (adding a provider to an *already authenticated* session)
 * is handled separately in linkProviderToUser.
 */
export async function findOrCreateUserFromProvider(identity: IdentitySeed) {
  const [existingAccount] = await db
    .select()
    .from(authAccounts)
    .where(
      and(eq(authAccounts.provider, identity.provider), eq(authAccounts.providerAccountId, identity.providerAccountId))
    )
    .limit(1);

  if (existingAccount) {
    return existingAccount.userId;
  }

  const username = await generateUniqueUsername(identity.usernameSeed);

  const userId = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: identity.email })
      .returning({ id: users.id });

    await tx.insert(profiles).values({
      userId: user.id,
      username,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
    });

    await tx.insert(authAccounts).values({
      userId: user.id,
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
      metadata: identity.metadata,
    });

    return user.id;
  });

  return userId;
}

export class ProviderAlreadyLinkedError extends Error {
  constructor() {
    super("This account is already linked to a different OwnReach profile.");
  }
}

export async function linkProviderToUser(userId: string, identity: IdentitySeed) {
  const [existingAccount] = await db
    .select()
    .from(authAccounts)
    .where(
      and(eq(authAccounts.provider, identity.provider), eq(authAccounts.providerAccountId, identity.providerAccountId))
    )
    .limit(1);

  if (existingAccount && existingAccount.userId !== userId) {
    throw new ProviderAlreadyLinkedError();
  }
  if (existingAccount) return; // already linked to this same user

  await db.insert(authAccounts).values({
    userId,
    provider: identity.provider,
    providerAccountId: identity.providerAccountId,
    metadata: identity.metadata,
  });
}

export async function getLinkedProviders(userId: string) {
  return db.select().from(authAccounts).where(eq(authAccounts.userId, userId));
}
