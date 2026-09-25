import { pgEnum, pgTable, jsonb, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

export const authProviderEnum = pgEnum("auth_provider", ["google", "telegram", "wallet", "email", "password"]);

// One row per linked identity. A single `users` row can have up to one account
// per provider — this is what makes multi-provider account linking possible.
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProviderEnum("provider").notNull(),
    // google -> Google `sub`; telegram -> Telegram numeric user id; wallet -> checksummed address; password -> normalized email
    providerAccountId: text("provider_account_id").notNull(),
    // Only set for provider = "password" — an Argon2id encoded hash string (self-describing: algorithm/cost params travel with it).
    passwordHash: text("password_hash"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_account_unique").on(table.provider, table.providerAccountId),
  ]
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Only a SHA-256 hash of the token is stored; the raw token lives solely in the cookie.
  sessionTokenHash: text("session_token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Short-lived nonces for SIWE (wallet) sign-in — issued, then consumed exactly once on verify.
export const siweNonces = pgTable("siwe_nonces", {
  nonce: text("nonce").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export interface TelegramProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

// Bot-deep-link Telegram login: a browser starts a request (pending), our
// bot's webhook confirms it once the user hits Start in Telegram, and the
// browser's poll consumes it exactly once via an atomic
// `status = 'confirmed'` claim — see /api/auth/telegram/{start,status}.
export const telegramLoginRequests = pgTable("telegram_login_requests", {
  token: text("token").primaryKey(),
  mode: text("mode", { enum: ["signin", "link"] }).notNull(),
  linkUserId: uuid("link_user_id").references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "confirmed"] }).notNull().default("pending"),
  telegramProfile: jsonb("telegram_profile").$type<TelegramProfile>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Passwordless email sign-in: a browser posts an email address, we mail a
// single-use link, and clicking it (the /api/auth/email/verify GET request)
// both confirms and completes the login in one step — unlike Telegram's
// pending/confirmed dance, there's no separate out-of-band confirmer here,
// so the row is deleted atomically on first use instead of status-flipped.
export const emailLoginRequests = pgTable("email_login_requests", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  mode: text("mode", { enum: ["signin", "link"] }).notNull(),
  linkUserId: uuid("link_user_id").references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Single-use password-reset link — kept separate from emailLoginRequests
// since a reset is tied to an existing password credential, not a
// signin/link decision, and conflating the two would make both harder to reason about.
export const passwordResetRequests = pgTable("password_reset_requests", {
  token: text("token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuthAccount = typeof authAccounts.$inferSelect;
export type NewAuthAccount = typeof authAccounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type TelegramLoginRequest = typeof telegramLoginRequests.$inferSelect;
export type EmailLoginRequest = typeof emailLoginRequests.$inferSelect;
export type PasswordResetRequest = typeof passwordResetRequests.$inferSelect;
