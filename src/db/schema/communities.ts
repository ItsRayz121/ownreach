import { index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const communityVisibilityEnum = pgEnum("community_visibility", ["public", "private"]);
export const communityRoleEnum = pgEnum("community_role", ["owner", "admin", "member"]);

export const communities = pgTable(
  "communities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    avatarUrl: text("avatar_url"),
    visibility: communityVisibilityEnum("visibility").notNull().default("public"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("communities_visibility_created_idx").on(table.visibility, table.createdAt)]
);

// Ownership is modeled as a role row here, not a separate `communities.ownerId`
// column, to avoid two sources of truth — createCommunity always inserts the
// creator as the single "owner" row, and v1 has no ownership-transfer action.
export const communityMembers = pgTable(
  "community_members",
  {
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: communityRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    // Null until the member opens the community at least once — mirrors
    // conversationParticipants.lastReadAt, used for a per-community unread
    // indicator (channel messages don't create notification rows, see
    // lib/actions/communities.ts).
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.communityId, table.userId], name: "community_members_community_id_user_id_pk" }),
    index("community_members_user_idx").on(table.userId),
  ]
);

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("channels_community_position_idx").on(table.communityId, table.position)]
);

export const channelMessages = pgTable(
  "channel_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("channel_messages_channel_created_idx").on(table.channelId, table.createdAt)]
);

export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;
export type CommunityMember = typeof communityMembers.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type ChannelMessage = typeof channelMessages.$inferSelect;
