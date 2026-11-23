/**
 * Numbers for sharing a past check-in: everything as of that post's own
 * local date (its streak and its Mon–Sun week up to that day), never today.
 * Pure; built on the shared streak rules.
 */
import { feedDayNumber } from "@/lib/feed-view";
import { weekCounts, weekDayStates, weekStartIso, type WeekDayState } from "@/lib/streak-rules";

export type ShareMediaKind = "video" | "photo";

const VIDEO_RE = /\.(mp4|mov|m4v|webm|3gp)(\?|#|$)/i;

/** What a check-in's stored media is, or null when it has none. */
export function shareMediaKind(path: string | null | undefined): ShareMediaKind | null {
  if (!path) return null;
  return VIDEO_RE.test(path) ? "video" : "photo";
}

export function postShareNumbers(opts: {
  checkInDates: Iterable<string>;
  coveredDates: Iterable<string>;
  /** The post's local date (YYYY-MM-DD). */
  date: string;
  target: number;
}): { streak: number; week: { done: number; target: number; days: WeekDayState[] } } {
  const checks = new Set<string>();
  for (const d of opts.checkInDates) if (d <= opts.date) checks.add(d);
  checks.add(opts.date);
  const covered = new Set<string>();
  for (const d of opts.coveredDates) if (d <= opts.date) covered.add(d);
  return {
    streak: Math.max(1, feedDayNumber(checks, covered, opts.date)),
    week: {
      done: weekCounts(checks, opts.date).thisWeek,
      target: opts.target,
      days: weekDayStates(weekStartIso(opts.date), checks, covered).map((d) => d.state),
    },
  };
}

const ACTIVITY_LABELS: Record<string, string> = {
  meal: "Meal",
  workout: "Workout",
  run: "Run",
  progress: "Progress",
  sleep: "Sleep",
  water: "Water",
  meditation: "Meditation",
};

/** The check-in's activity tag as shown on the card ("Workout"), if any. */
export const activityLabelFor = (id: string | null | undefined): string | null =>
  (id && ACTIVITY_LABELS[id]) || null;
