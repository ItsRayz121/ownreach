import "server-only";

function officialPostEmails(): Set<string> {
  const raw = process.env.OFFICIAL_POST_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isOfficialPostEmail(email?: string | null): boolean {
  if (!email) return false;
  return officialPostEmails().has(email.toLowerCase());
}

interface PostPermissionSession {
  role: string;
  isCreator?: boolean | null;
  email?: string | null;
}

/** Post creation is restricted to admins, admin-approved creators, and designated official accounts. */
export function canCreatePost(session: PostPermissionSession | null | undefined): boolean {
  if (!session) return false;
  return session.role === "admin" || session.isCreator === true || isOfficialPostEmail(session.email);
}
