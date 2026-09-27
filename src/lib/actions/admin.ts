"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, reports, profiles } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";

async function requireAdmin() {
  const session = await verifySession();
  if (!session || session.role !== "admin") throw new Error("Admins only.");
  return session;
}

export async function suspendUser(userId: string) {
  await requireAdmin();
  await db.update(users).set({ status: "suspended" }).where(eq(users.id, userId));
  revalidatePath("/admin/users");
}

export async function reinstateUser(userId: string) {
  await requireAdmin();
  await db.update(users).set({ status: "active" }).where(eq(users.id, userId));
  revalidatePath("/admin/users");
}

/** Approves or revokes a profile as a high-quality creator — required to post (see lib/permissions.ts). */
export async function setCreatorStatus(userId: string, isCreator: boolean) {
  await requireAdmin();
  await db.update(profiles).set({ isCreator }).where(eq(profiles.userId, userId));
  revalidatePath("/admin/users");
}

export async function resolveReport(reportId: string) {
  await requireAdmin();
  await db.update(reports).set({ status: "resolved" }).where(eq(reports.id, reportId));
  revalidatePath("/admin");
}

export async function dismissReport(reportId: string) {
  await requireAdmin();
  await db.update(reports).set({ status: "dismissed" }).where(eq(reports.id, reportId));
  revalidatePath("/admin");
}
