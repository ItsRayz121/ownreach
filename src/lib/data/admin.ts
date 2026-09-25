import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { channelMessages, comments, posts, profiles, reports, users, type Report } from "@/db/schema";

export interface ReportItem {
  id: string;
  targetType: Report["targetType"];
  targetId: string;
  reason: string;
  createdAt: Date;
  reporter: { username: string; displayName: string } | null;
  preview: string | null;
}

export async function listOpenReports(): Promise<ReportItem[]> {
  const rows = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      createdAt: reports.createdAt,
      reporterId: reports.reporterId,
    })
    .from(reports)
    .where(eq(reports.status, "open"))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  if (rows.length === 0) return [];

  const reporterIds = [...new Set(rows.map((r) => r.reporterId))];
  const postIds = rows.filter((r) => r.targetType === "post").map((r) => r.targetId);
  const commentIds = rows.filter((r) => r.targetType === "comment").map((r) => r.targetId);
  const userTargetIds = rows.filter((r) => r.targetType === "user").map((r) => r.targetId);
  const communityMessageIds = rows.filter((r) => r.targetType === "community_message").map((r) => r.targetId);

  const [reporters, postRows, commentRows, userRows, communityMessageRows] = await Promise.all([
    db
      .select({ userId: profiles.userId, username: profiles.username, displayName: profiles.displayName })
      .from(profiles)
      .where(inArray(profiles.userId, reporterIds)),
    postIds.length
      ? db.select({ id: posts.id, body: posts.body }).from(posts).where(inArray(posts.id, postIds))
      : Promise.resolve([]),
    commentIds.length
      ? db.select({ id: comments.id, body: comments.body }).from(comments).where(inArray(comments.id, commentIds))
      : Promise.resolve([]),
    userTargetIds.length
      ? db.select({ userId: profiles.userId, username: profiles.username }).from(profiles).where(inArray(profiles.userId, userTargetIds))
      : Promise.resolve([]),
    communityMessageIds.length
      ? db.select({ id: channelMessages.id, body: channelMessages.body }).from(channelMessages).where(inArray(channelMessages.id, communityMessageIds))
      : Promise.resolve([]),
  ]);

  const reporterMap = new Map(reporters.map((r) => [r.userId, r]));
  const postMap = new Map(postRows.map((p) => [p.id, p.body]));
  const commentMap = new Map(commentRows.map((c) => [c.id, c.body]));
  const userMap = new Map(userRows.map((u) => [u.userId, `@${u.username}`]));
  const communityMessageMap = new Map(communityMessageRows.map((m) => [m.id, m.body]));

  return rows.map((r) => ({
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    createdAt: r.createdAt,
    reporter: reporterMap.get(r.reporterId) ?? null,
    preview:
      r.targetType === "post"
        ? (postMap.get(r.targetId) ?? null)
        : r.targetType === "comment"
          ? (commentMap.get(r.targetId) ?? null)
          : r.targetType === "community_message"
            ? (communityMessageMap.get(r.targetId) ?? null)
            : (userMap.get(r.targetId) ?? null),
  }));
}

export interface AdminUserRow {
  id: string;
  username: string;
  displayName: string;
  role: "user" | "creator" | "admin";
  status: "active" | "suspended";
  createdAt: Date;
}

export async function listUsers(query?: string): Promise<AdminUserRow[]> {
  const searchFilter = query ? sql`(${profiles.username} ILIKE ${"%" + query + "%"} OR ${profiles.displayName} ILIKE ${"%" + query + "%"})` : undefined;

  return db
    .select({
      id: users.id,
      username: profiles.username,
      displayName: profiles.displayName,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(searchFilter)
    .orderBy(desc(users.createdAt))
    .limit(50);
}
