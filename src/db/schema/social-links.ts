import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const socialPlatformEnum = pgEnum("social_platform", [
  "youtube",
  "instagram",
  "facebook",
  "twitter",
  "telegram",
  "tiktok",
  "github",
  "twitch",
  "discord",
  "linkedin",
  "other",
]);

export const profileSocialLinks = pgTable(
  "profile_social_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: socialPlatformEnum("platform").notNull(),
    // Only used (and required) when platform === "other" — the display name
    // for a platform not in the preset dropdown.
    label: text("label"),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("profile_social_links_user_position_idx").on(table.userId, table.position)]
);

export type ProfileSocialLink = typeof profileSocialLinks.$inferSelect;
export type NewProfileSocialLink = typeof profileSocialLinks.$inferInsert;
