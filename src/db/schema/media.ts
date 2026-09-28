import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// Standalone table (mirrors messagePolls) referenced by a nullable `mediaId`
// FK from both `messages` and `channelMessages` — sidesteps a circular
// import between this file and messages.ts/communities.ts. Soft-deleted (see
// `removedAt`) rather than hard-deleted, whether by the retention cron
// (api/cron/purge-expired-media) or a user's manual delete, so the owning
// message can still render a "photo removed/expired" placeholder instead of
// silently going blank.
export const messageMedia = pgTable(
  "message_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url"),
    // Cloudinary public_id — needed to call the destroy API once the asset
    // is purged/removed; null again once that's happened (nothing left to destroy).
    publicId: text("public_id"),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Computed once at insert time from the sending surface's retention
    // window (lib/media-retention.ts) — a fixed point in time, not
    // recomputed later, so the purge cron is a cheap `expiresAt < now()` scan.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => [
    index("message_media_expires_at_idx").on(table.expiresAt),
    // Guards against the same Cloudinary asset getting attached to two
    // messageMedia rows (e.g. a replayed/duplicated sendMessage call reusing
    // one upload's publicId) — without it, deleting the photo from one
    // message would destroy() the shared asset while the other row's
    // removedAt stayed null, leaving that message showing a permanently
    // broken image with no signal anything's wrong. Multiple NULLs (every
    // already-removed row) are still allowed — Postgres unique indexes treat
    // NULL as distinct from any other NULL.
    uniqueIndex("message_media_public_id_idx").on(table.publicId),
  ]
);

export type MessageMedia = typeof messageMedia.$inferSelect;
