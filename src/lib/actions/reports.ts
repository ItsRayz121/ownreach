"use server";

import { z } from "zod";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ratelimit";

const fileReportSchema = z.object({
  targetType: z.enum(["post", "comment", "user"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(1, "Tell us what's wrong.").max(500, "Keep it under 500 characters."),
});

export async function fileReport(input: z.infer<typeof fileReportSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in to report content.");
  await checkRateLimit("report:create", session.userId, { limit: 20, window: "10 m" });

  const parsed = fileReportSchema.parse(input);
  await db.insert(reports).values({ reporterId: session.userId, ...parsed });
}
