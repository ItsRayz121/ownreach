/** Classic Levenshtein edit distance, case-insensitive. */
function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const rows = s.length + 1;
  const cols = t.length + 1;
  const dp: number[] = new Array(rows * cols);

  for (let i = 0; i < rows; i++) dp[i * cols] = i;
  for (let j = 0; j < cols; j++) dp[j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i * cols + j] = Math.min(
        dp[(i - 1) * cols + j] + 1,
        dp[i * cols + (j - 1)] + 1,
        dp[(i - 1) * cols + (j - 1)] + cost
      );
    }
  }

  return dp[rows * cols - 1];
}

/** 0 (no similarity) to 1 (identical), based on normalized edit distance. */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - editDistance(a, b) / maxLen;
}

/** Ranks `candidates` by similarity of `key(candidate)` against `query`, best first. */
export function rankBySimilarity<T>(query: string, candidates: T[], key: (item: T) => string): T[] {
  return [...candidates]
    .map((item) => ({ item, score: similarity(query, key(item)) }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
