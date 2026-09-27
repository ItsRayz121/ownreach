import { foreignKey, index, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { messagePolls } from "./polls";

// "accepted": normal, unrestricted DM. "pending": a message request from
// `initiatorId` awaiting the other participant's accept/decline — the
// initiator is capped to a few messages until then (see
// lib/actions/messages.ts#sendMessage). "declined": hidden from the
// recipient's inbox, initiator can no longer send.
export const conversationStatusEnum = pgEnum("conversation_status", ["accepted", "pending", "declined"]);

// 1:1 only for now — no `is_group` flag yet. A conversation is looked up by
// finding a row shared between exactly two participants (see
// lib/data/messages.ts#findConversationBetween) rather than a uniqueness
// constraint on participant sets, the same composite-key join-table
// approach as `follows`/`postReactions`.
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: conversationStatusEnum("status").notNull().default("accepted"),
  // Null for conversations created before the request system (and thus
  // implicitly "accepted"), and for any row where status is "accepted"
  // because the participants already mutually followed each other.
  initiatorId: uuid("initiator_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Null until the participant opens the thread at least once.
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId], name: "conversation_participants_conversation_id_user_id_pk" }),
    index("conversation_participants_user_idx").on(table.userId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    // Set once the recipient's client has received/fetched this message —
    // distinct from `read`, which is derived from the recipient's
    // conversationParticipants.lastReadAt (see lib/data/messages.ts).
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    // Nullable, self-referencing "reply to" — mirrors comments.parentCommentId.
    // onDelete "set null" so removing the original doesn't cascade-delete replies.
    replyToMessageId: uuid("reply_to_message_id"),
    // Set only when the reply quotes a highlighted substring rather than the
    // whole original body.
    replyExcerpt: text("reply_excerpt"),
    // Set when the sender edits `body` after sending — WhatsApp-style,
    // editable any time, no expiry window.
    editedAt: timestamp("edited_at", { withTimezone: true }),
    // Exactly one of sharedContactId/pollId is set for a "share a contact" or
    // "poll" message; both null means an ordinary text message. `body` is
    // still NOT NULL for these (stored as ""), since they're inserted by
    // separate actions (shareContact/createPoll) that never go through the
    // sendMessage validation requiring non-empty text.
    sharedContactId: uuid("shared_contact_id").references(() => users.id, { onDelete: "set null" }),
    pollId: uuid("poll_id").references(() => messagePolls.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
    foreignKey({
      columns: [table.replyToMessageId],
      foreignColumns: [table.id],
      name: "messages_reply_to_message_id_fk",
    }).onDelete("set null"),
  ]
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.userId], name: "message_reactions_message_id_user_id_pk" }),
    index("message_reactions_message_idx").on(table.messageId),
  ]
);

export type Conversation = typeof conversations.$inferSelect;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageReaction = typeof messageReactions.$inferSelect;
