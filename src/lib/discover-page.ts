import type { Plan } from "./workout-plans";
import type { DiscoverQuery, DiscoverCard } from "./discover-workouts";

export const normalizeSearch = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const searchMatches = (query: string, fields: readonly string[]) =>
  normalizeSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => fields.some((field) => normalizeSearch(field).includes(word)));
export function discoverTopCard(
  active: boolean,
  saved: boolean,
): "onPlan" | "quizNotTaken" | "quizTaken" {
  return active ? "onPlan" : saved ? "quizTaken" : "quizNotTaken";
}
export const showDiscoverRow = (count: number, loading: boolean, failed: boolean) =>
  loading || failed || count > 0;
export function popularPlans<T extends Pick<Plan, "id" | "slug">>(
  plans: readonly T[],
  starts: Record<string, number>,
  activeSlug: string | null,
) {
  return [...plans]
    .filter((p) => p.slug !== activeSlug)
    .sort((a, b) => (starts[b.id] ?? 0) - (starts[a.id] ?? 0))
    .slice(0, 8);
}
export type SearchPerson = {
  id: string;
  name: string;
  username: string | null;
  bio: string | null;
  avatar: string | null;
  isPrivate: boolean;
  relationship: string;
  canFollow: boolean;
  context: string;
  isYou: boolean;
};
export type SearchResults = {
  people: SearchPerson[];
  workouts: DiscoverCard[];
  plans: Plan[];
  suggestion: string | null;
};
export function searchGroups(results: SearchResults, expanded: readonly string[] = []) {
  return (["people", "workouts", "plans"] as const)
    .map((key) => ({
      key,
      total: results[key].length,
      items: expanded.includes(key) ? results[key] : results[key].slice(0, 3),
      seeAll: results[key].length > 3 ? `See all ${results[key].length}` : null,
    }))
    .filter((group) => group.total > 0);
}
export function searchablePerson(input: {
  blockedEitherWay: boolean;
  under18: boolean;
  viewerAdult: boolean;
  newVersion: boolean;
}) {
  return !input.blockedEitherWay && !(input.viewerAdult && input.under18) && input.newVersion;
}
export const RECENT_SEARCH_KEY = "pactara-discover-recent";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export function recentSearches(previous: readonly string[], query: string) {
  const clean = query.trim();
  return clean
    ? [clean, ...previous.filter((p) => normalizeSearch(p) !== normalizeSearch(clean))].slice(0, 8)
    : [...previous].slice(0, 8);
}
export function readRecentSearches(storage: StorageLike): string[] {
  try {
    const v: unknown = JSON.parse(storage.getItem(RECENT_SEARCH_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}
export function writeRecentSearches(storage: StorageLike, values: readonly string[]) {
  try {
    storage.setItem(RECENT_SEARCH_KEY, JSON.stringify(values.slice(0, 8)));
  } catch {
    /* Phone storage may be disabled. */
  }
}
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        (next[j - 1] ?? 0) + 1,
        (row[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length] ?? 99;
}
export function didYouMean(query: string, names: readonly string[]): string | null {
  const q = normalizeSearch(query);
  if (q.length < 3) return null;
  const candidates = [...new Set(names)].map((name) => ({ name, norm: normalizeSearch(name) }));
  if (candidates.some((c) => c.norm === q)) return null;
  const ranked = candidates
    .map((c) => ({ ...c, d: distance(q, c.norm) }))
    .sort((a, b) => a.d - b.d || a.name.localeCompare(b.name));
  const best = ranked[0];
  return best && best.d <= (q.length <= 5 ? 2 : 3) ? best.name : null;
}

export function workoutEmptyLine(q: DiscoverQuery) {
  const muscle = q.muscle === "all" ? "your search" : q.muscle;
  const gear = q.equipment
    ? ` with ${q.equipment === "home" ? "home equipment" : q.equipment === "gym" ? "gym equipment" : q.equipment === "kettlebell" ? "a kettlebell" : "dumbbells"}`
    : "";
  const time =
    q.time === "u15"
      ? " under 15 min"
      : q.time === "u20"
        ? " under 20 min"
        : q.time === "20-40"
          ? " in 20-40 min"
          : q.time === "40plus"
            ? " over 40 min"
            : "";
  return `Nothing for ${muscle}${gear}${time}. Try fewer filters.`;
}
