import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const reportTargetTypeEnum = pgEnum("report_target_type", ["post", "comment", "user", "community_message"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "resolved", "dismissed"]);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: reportTargetTypeEnum("target_type").notNull(),
    // No FK — polymorphic (points at posts.id, comments.id, users.id, or
    // channelMessages.id depending on targetType), resolved by lookup in lib/data/admin.ts.
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("reports_status_created_idx").on(table.status, table.createdAt)]
);

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
