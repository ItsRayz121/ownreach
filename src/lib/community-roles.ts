import type { CommunityMember } from "@/db/schema";

/** Owner and admin are both "manager" roles for UI/permission purposes — kept in one place so a future role addition can't drift between call sites. */
export function isCommunityManager(role: CommunityMember["role"] | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
