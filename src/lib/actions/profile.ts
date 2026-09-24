"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required.").max(60),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
  location: z.string().trim().max(60).optional().or(z.literal("")),
  website: z.string().trim().url("Enter a full URL, including https://").max(200).optional().or(z.literal("")),
});

export async function updateProfile(input: z.infer<typeof updateProfileSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const parsed = updateProfileSchema.parse(input);

  await db
    .update(profiles)
    .set({
      displayName: parsed.displayName,
      bio: parsed.bio || null,
      location: parsed.location || null,
      website: parsed.website || null,
    })
    .where(eq(profiles.userId, session.userId));

  revalidatePath(`/${session.username}`);
  revalidatePath("/settings/profile");
}

export async function updateProfileImage(kind: "avatar" | "cover", url: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  await db
    .update(profiles)
    .set(kind === "avatar" ? { avatarUrl: url } : { coverUrl: url })
    .where(eq(profiles.userId, session.userId));

  revalidatePath(`/${session.username}`);
  revalidatePath("/settings/profile");
}
