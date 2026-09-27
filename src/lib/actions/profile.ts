"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles, profileSocialLinks, socialPlatformEnum } from "@/db/schema";
import { verifySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { isUniqueViolation } from "@/lib/db-errors";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required.").max(60),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
  location: z.string().trim().max(60).optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .url("Enter a full URL, including https://")
    .max(200)
    .refine((url) => /^https?:\/\//i.test(url), "Only http:// or https:// links are allowed.")
    .optional()
    .or(z.literal("")),
});

function isCloudinaryUrl(url: string) {
  try {
    return new URL(url).hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}

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

const updateUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "3-20 lowercase letters, numbers, or underscores."),
});

export async function updateUsername(input: z.infer<typeof updateUsernameSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");
  await checkRateLimit("profile:username:change", session.userId, { limit: 5, window: "60 m" });

  const parsed = updateUsernameSchema.parse(input);

  try {
    await db.update(profiles).set({ username: parsed.username }).where(eq(profiles.userId, session.userId));
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error("That username's taken.");
    throw err;
  }

  revalidatePath(`/${session.username}`);
  revalidatePath(`/${parsed.username}`);
  revalidatePath("/settings/profile");
  return { username: parsed.username };
}

export async function updateProfileImage(kind: "avatar" | "cover", url: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  if (!isCloudinaryUrl(url)) throw new Error("Image must be uploaded through Cloudinary.");

  await db
    .update(profiles)
    .set(kind === "avatar" ? { avatarUrl: url } : { coverUrl: url })
    .where(eq(profiles.userId, session.userId));

  revalidatePath(`/${session.username}`);
  revalidatePath("/settings/profile");
}

const MAX_SOCIAL_LINKS = 10;

const addSocialLinkSchema = z.object({
  platform: z.enum(socialPlatformEnum.enumValues),
  label: z.string().trim().max(30).optional(),
  url: z
    .string()
    .trim()
    .url("Enter a full URL, including https://")
    .max(200)
    .refine((url) => /^https?:\/\//i.test(url), "Only http:// or https:// links are allowed."),
});

export async function addSocialLink(input: z.infer<typeof addSocialLinkSchema>) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  const parsed = addSocialLinkSchema.parse(input);
  if (parsed.platform === "other" && !parsed.label) {
    throw new Error("Give this link a name.");
  }

  const link = await db.transaction(async (tx) => {
    // Locks the caller's own profile row so two concurrent adds (double
    // click, two tabs) serialize instead of both reading the same
    // pre-insert count and both passing the cap check.
    await tx.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, session.userId)).for("update");

    const [{ value: existing }] = await tx
      .select({ value: count() })
      .from(profileSocialLinks)
      .where(eq(profileSocialLinks.userId, session.userId));
    if (existing >= MAX_SOCIAL_LINKS) {
      throw new Error(`You can add up to ${MAX_SOCIAL_LINKS} social links.`);
    }

    const [inserted] = await tx
      .insert(profileSocialLinks)
      .values({
        userId: session.userId,
        platform: parsed.platform,
        label: parsed.platform === "other" ? parsed.label : null,
        url: parsed.url,
        position: existing,
      })
      .returning({ id: profileSocialLinks.id, platform: profileSocialLinks.platform, label: profileSocialLinks.label, url: profileSocialLinks.url });
    return inserted;
  });

  revalidatePath(`/${session.username}`);
  revalidatePath("/settings/profile");
  return link;
}

export async function deleteSocialLink(id: string) {
  const session = await verifySession();
  if (!session) throw new Error("You must be signed in.");

  await db
    .delete(profileSocialLinks)
    .where(and(eq(profileSocialLinks.id, id), eq(profileSocialLinks.userId, session.userId)));

  revalidatePath(`/${session.username}`);
  revalidatePath("/settings/profile");
}
