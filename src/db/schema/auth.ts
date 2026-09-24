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

export type AuthAccount = typeof authAccounts.$inferSelect;
export type NewAuthAccount = typeof authAccounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
