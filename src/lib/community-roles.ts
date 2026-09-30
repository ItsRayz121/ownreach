import type { CommunityMember } from "@/db/schema";

/** Stand-in `senderId` shown to non-managers for messages posted as the channel, so the real admin is never sent to their browser. */
export const CHANNEL_SENDER_ID = "channel";

/** Owner and admin are both "manager" roles for UI/permission purposes — kept in one place so a future role addition can't drift between call sites. */
export function isCommunityManager(role: CommunityMember["role"] | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
