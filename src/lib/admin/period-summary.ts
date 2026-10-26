import { pct } from "./analytics-data";

type Commitment = { user_id: string; group_id: string; local_date: string; check_in_id: string | null };

/** Count people and commitment days once, even when shared across groups. */
export function buildPeriodSummary(input: {
  from: string;
  to: string;
  activity: Map<string, Set<string>>;
  signups: string[];
  posts: Commitment[];
  opens: Map<string, number>;
}) {
  const includes = (day: string) => day >= input.from && day <= input.to;
  const posts = input.posts.filter((p) => includes(p.local_date));
  const commitments = new Map<string, boolean>();
  for (const post of posts) {
    const key = `${post.user_id}|${post.local_date}`;
    commitments.set(key, (commitments.get(key) ?? false) || post.check_in_id !== null);
  }
  const completed = [...commitments.values()].filter(Boolean).length;
  return {
    activeUsers: [...input.activity.values()].filter((days) => [...days].some(includes)).length,
    newAccounts: input.signups.filter(includes).length,
    commitments: commitments.size,
    completed,
    completionRate: pct(completed, commitments.size),
    activeGroups: new Set(posts.map((p) => p.group_id)).size,
    opens: [...input.opens].reduce((total, [day, count]) => total + (includes(day) ? count : 0), 0),
  };
}