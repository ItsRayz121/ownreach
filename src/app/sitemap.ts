import type { MetadataRoute } from "next";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { desc } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const recentProfiles = await db
    .select({ username: profiles.username, createdAt: profiles.createdAt })
    .from(profiles)
    .orderBy(desc(profiles.createdAt))
    .limit(1000);

  return [
    { url: appUrl, changeFrequency: "daily", priority: 1 },
    { url: `${appUrl}/explore`, changeFrequency: "hourly", priority: 0.8 },
    ...recentProfiles.map((profile) => ({
      url: `${appUrl}/${profile.username}`,
      lastModified: profile.createdAt,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
