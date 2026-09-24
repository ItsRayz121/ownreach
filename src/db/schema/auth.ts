import { pgEnum, pgTable, jsonb, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

export const authProviderEnum = pgEnum("auth_provider", ["google", "telegram", "wallet"]);

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
    // google -> Google `sub`; telegram -> Telegram numeric user id; wallet -> checksummed address
    providerAccountId: text("provider_account_id").notNull(),
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

export type AuthAccount = typeof authAccounts.$inferSelect;
export type NewAuthAccount = typeof authAccounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type TelegramLoginRequest = typeof telegramLoginRequests.$inferSelect;
