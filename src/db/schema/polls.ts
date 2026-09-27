import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// Powers both DM and group/channel polls. The owning message row
// (messages.pollId or channelMessages.pollId — exactly one, set at creation)
// is the source of truth for which conversation/channel a poll belongs to;
// voting looks that owner up rather than duplicating conversationId/channelId
// here, which also sidesteps a cross-file circular import between this file
// and messages.ts/communities.ts.
export const messagePolls = pgTable("message_polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  allowMultiple: boolean("allow_multiple").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messagePollOptions = pgTable(
  "message_poll_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => messagePolls.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("message_poll_options_poll_idx").on(table.pollId)]
);

// PK on (optionId, userId) rather than (pollId, userId) so a single-choice
// poll's "pick a different option" flow is delete-then-insert on the old
// option, while a multi-choice poll can hold several rows per (pollId,
// userId) — one per option — without conflicting.
export const messagePollVotes = pgTable(
  "message_poll_votes",
  {
    pollId: uuid("poll_id")
      .notNull()
      .references(() => messagePolls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => messagePollOptions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.optionId, table.userId], name: "message_poll_votes_option_id_user_id_pk" }),
    index("message_poll_votes_poll_idx").on(table.pollId),
  ]
);

export type MessagePoll = typeof messagePolls.$inferSelect;
export type MessagePollOption = typeof messagePollOptions.$inferSelect;
export type MessagePollVote = typeof messagePollVotes.$inferSelect;
