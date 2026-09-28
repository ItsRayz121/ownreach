// How long a chat image is kept before the purge cron
// (api/cron/purge-expired-media) reclaims its storage. Channels are
// broadcast-style and lower-traffic, so they get the longest window; groups
// are the highest-volume/noisiest surface, so they get the shortest.
export const MEDIA_RETENTION_DAYS = {
  dm: 60,
  group: 14,
  channel: 30,
} as const;

export type MediaSurface = keyof typeof MEDIA_RETENTION_DAYS;

/** Computed once at insert time so the purge cron is a cheap `expiresAt < now()` scan. */
export function mediaExpiryDate(surface: MediaSurface): Date {
  const days = MEDIA_RETENTION_DAYS[surface];
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
