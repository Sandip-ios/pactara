/**
 * Pure helpers for the Home feed: who-cheered sentence, Day n, day headers
 * and the combined quiet row on past days. Dates are local calendar
 * dates ("YYYY-MM-DD"); streak math comes from streak-rules.
 */
import { addDaysIso, currentStreak } from "@/lib/streak-rules";

export type Reactor = {
  userId: string;
  name: string;
  firstName: string;
  avatarUrl: string | null;
  avatarColor: string;
  emoji: string;
  isMe: boolean;
};

export type CheerSummary =
  | { kind: "empty"; text: string }
  | { kind: "names"; names: string[]; extra: number }
  | { kind: "own"; count: number };

/** You first, then everyone else in the order they cheered. */
export function orderReactors<T extends { isMe: boolean }>(reactors: T[]): T[] {
  return [...reactors.filter((r) => r.isMe), ...reactors.filter((r) => !r.isMe)];
}

/**
 * Right side of the action row.
 * Someone else's post: "Michele, Busi" / "You, Michele +1" / "Bertille",
 * or "Be the first to cheer". Your own post: "{n} cheered you on" / "No cheers yet".
 */
export function cheerSummary(reactors: Reactor[], ownPost: boolean): CheerSummary {
  if (ownPost) {
    if (reactors.length === 0) return { kind: "empty", text: "No cheers yet" };
    return { kind: "own", count: reactors.length };
  }
  if (reactors.length === 0) return { kind: "empty", text: "Be the first to cheer" };
  const ordered = orderReactors(reactors);
  const names = ordered.slice(0, 2).map((r) => (r.isMe ? "You" : r.firstName));
  return { kind: "names", names, extra: Math.max(0, ordered.length - 2) };
}

/** Plain-text version of the cheer summary (aria-labels, tests). */
export function cheerSentence(reactors: Reactor[], ownPost: boolean): string {
  const s = cheerSummary(reactors, ownPost);
  if (s.kind === "empty") return s.text;
  if (s.kind === "own") return `${s.count} cheered you on`;
  return `${s.names.join(", ")}${s.extra > 0 ? ` +${s.extra}` : ""}`;
}

/**
 * "Day n" on a check-in card: the member's streak in this group as of that
 * post's local date (check-ins plus rest and freeze rows).
 */
export function feedDayNumber(checkIns: Iterable<string>, covered: Iterable<string>, postDate: string): number {
  const kept = new Set<string>();
  for (const d of checkIns) if (d <= postDate) kept.add(d);
  for (const d of covered) if (d <= postDate) kept.add(d);
  return currentStreak(kept, postDate);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function weekdayName(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
}

/** "Today · Sunday", "Yesterday · Saturday", then "Monday · Nov 16" for every older day. */
export function dayHeaderLabel(date: string, viewerToday: string): string {
  const day = weekdayName(date);
  if (date >= viewerToday) return `Today · ${weekdayName(viewerToday)}`;
  if (date === addDaysIso(viewerToday, -1)) return `Yesterday · ${day}`;
  const [, m, d] = date.split("-").map(Number);
  return `${day} · ${MONTHS[m - 1]} ${d}`;
}

/** The feed's day key: a member a timezone ahead is still shown under "Today". */
export function feedDayKey(date: string, viewerToday: string): string {
  return date > viewerToday ? viewerToday : date;
}

/** "Bertille", "Bertille and you", "Ana, Ben and you". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export type DayStat = {
  date: string;
  checkedIn: string[];
  rested: string[];
  missed: string[];
  /** Members due that day: everyone who had joined, minus those resting. */
  due: number;
  groupStreak: number;
};

type QuietPerson = { firstName: string; isMe: boolean };

/**
 * The one quiet row under a past day: "Michele, Guy and you missed · Bertille rested".
 * Missed first, then rested; you come last as "you" ("You" only to open the line).
 */
export function quietDayLine(missed: QuietPerson[], rested: QuietPerson[]): string {
  const names = (people: QuietPerson[]) => {
    const others = people.filter((p) => !p.isMe).map((p) => p.firstName);
    return people.some((p) => p.isMe) ? [...others, "you"] : others;
  };
  const parts: string[] = [];
  if (missed.length) parts.push(`${joinNames(names(missed))} missed`);
  if (rested.length) parts.push(`${joinNames(names(rested))} rested`);
  const line = parts.join(" · ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** "15h left" / "45m left" until the member's day closes. */
export function timeLeftLabel(closesAtIso: string, now: Date = new Date()): string {
  const ms = Date.parse(closesAtIso) - now.getTime();
  if (!(ms > 0)) return "0m left";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

/** "View 1 comment" / "View all 4 comments". */
export function viewCommentsLabel(n: number): string {
  return n === 1 ? "View 1 comment" : `View all ${n} comments`;
}

/** Quick replies only on someone else's post with no cheers and no comments. */
export function showQuickReplies(input: { ownPost: boolean; cheers: number; comments: number }): boolean {
  return !input.ownPost && input.cheers === 0 && input.comments === 0;
}

export const QUICK_REPLIES = ["Let's go", "Proud of you", "Beast mode"] as const;

const ACTIVITY_META: Record<string, { emoji: string; label: string }> = {
  meal: { emoji: "🥗", label: "Meal" },
  workout: { emoji: "💪", label: "Workout" },
  run: { emoji: "🏃", label: "Run" },
  progress: { emoji: "📸", label: "Progress" },
  sleep: { emoji: "😴", label: "Sleep" },
  water: { emoji: "💧", label: "Water" },
  meditation: { emoji: "🧘", label: "Meditation" },
};

/** Label and emoji for a check-in activity tag, or null when untagged. */
export function activityParts(activity: string | null | undefined): { emoji: string | null; label: string } | null {
  const id = (activity ?? "").trim();
  if (!id) return null;
  const meta = ACTIVITY_META[id.toLowerCase()];
  if (meta) return meta;
  return { emoji: null, label: id.charAt(0).toUpperCase() + id.slice(1) };
}

/** "💪 Workout" for the meta line, or null when untagged. */
export function activityMeta(activity: string | null | undefined): string | null {
  const a = activityParts(activity);
  if (!a) return null;
  return a.emoji ? `${a.emoji} ${a.label}` : a.label;
}

/** "💪 Workout · Day 12 · 5:27 am" (activity part left out when untagged). */
export function checkInMetaLine(activity: string | null | undefined, dayNumber: number, time: string): string {
  return [activityMeta(activity), dayNumber > 0 ? `Day ${dayNumber}` : null, time].filter(Boolean).join(" · ");
}
