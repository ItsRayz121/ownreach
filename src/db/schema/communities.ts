import { foreignKey, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { messagePolls } from "./polls";

export const communityVisibilityEnum = pgEnum("community_visibility", ["public", "private"]);
export const communityRoleEnum = pgEnum("community_role", ["owner", "admin", "member"]);
export const communityKindEnum = pgEnum("community_kind", ["group", "channel"]);

export const communities = pgTable(
  "communities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    avatarUrl: text("avatar_url"),
    visibility: communityVisibilityEnum("visibility").notNull().default("public"),
    // "group": any member can post in the channel. "channel": only owner/admins
    // can post, everyone else is read-only (broadcast mode).
    kind: communityKindEnum("kind").notNull().default("group"),
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
    // Nullable, self-referencing "reply to" — see messages.replyToMessageId.
    replyToMessageId: uuid("reply_to_message_id"),
    replyExcerpt: text("reply_excerpt"),
    // See messages.editedAt/sharedContactId/pollId — same contract here.
    editedAt: timestamp("edited_at", { withTimezone: true }),
    sharedContactId: uuid("shared_contact_id").references(() => users.id, { onDelete: "set null" }),
    pollId: uuid("poll_id").references(() => messagePolls.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("channel_messages_channel_created_idx").on(table.channelId, table.createdAt),
    foreignKey({
      columns: [table.replyToMessageId],
      foreignColumns: [table.id],
      name: "channel_messages_reply_to_message_id_fk",
    }).onDelete("set null"),
  ]
);

export const channelMessageReactions = pgTable(
  "channel_message_reactions",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => channelMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.userId], name: "channel_message_reactions_message_id_user_id_pk" }),
    index("channel_message_reactions_message_idx").on(table.messageId),
  ]
);

// One row per (message, viewer) — the composite PK is what makes a repeat
// view a no-op, so "views" means unique viewers, not raw impressions. Used
// two ways depending on `communities.kind`: "channel" (broadcast) surfaces the
// raw count as an eye-icon view counter; "group" (conversational) surfaces it
// as WhatsApp-style read ticks (read-by-all vs. read-by-some), comparing the
// count against the community's member count instead of displaying it.
export const channelMessageViews = pgTable(
  "channel_message_views",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => channelMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.userId], name: "channel_message_views_message_id_user_id_pk" }),
    index("channel_message_views_message_idx").on(table.messageId),
  ]
);

export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;
export type CommunityMember = typeof communityMembers.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type ChannelMessage = typeof channelMessages.$inferSelect;
export type ChannelMessageView = typeof channelMessageViews.$inferSelect;
export type ChannelMessageReaction = typeof channelMessageReactions.$inferSelect;
