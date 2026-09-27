import type { socialPlatformEnum } from "@/db/schema";

export type SocialPlatform = (typeof socialPlatformEnum.enumValues)[number];

export const SOCIAL_PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter / X" },
  { value: "telegram", label: "Telegram" },
  { value: "tiktok", label: "TikTok" },
  { value: "github", label: "GitHub" },
  { value: "twitch", label: "Twitch" },
  { value: "discord", label: "Discord" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Other" },
];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.value, p.label])
) as Record<SocialPlatform, string>;
