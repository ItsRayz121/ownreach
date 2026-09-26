// Drizzle wraps the underlying driver error in a DrizzleQueryError, with the
// actual Postgres error (and its `code`) nested under `.cause` rather than on
// the top-level error — so a plain `err.code` check never matches. Walk the
// cause chain to find it.
function pgErrorCode(err: unknown, depth = 0): string | undefined {
  if (!err || typeof err !== "object" || depth > 5) return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") return code;
  return pgErrorCode((err as { cause?: unknown }).cause, depth + 1);
}

export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === "23505";
}
