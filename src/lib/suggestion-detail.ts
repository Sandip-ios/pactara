/** "1.2k" style follower count. */
export function formatFollowers(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(Math.floor(n / 100) / 10).toString()}k`;
  return `${(Math.floor(n / 100_000) / 10).toString()}m`;
}

/** Suggested-person detail line: first bio line + follower count, or just the count. */
export function suggestionDetail(bioLine: string | null, followers: number): string {
  const count = `${formatFollowers(followers)} ${followers === 1 ? "follower" : "followers"}`;
  const bio = bioLine?.trim();
  return bio ? `${bio} · ${count}` : count;
}
