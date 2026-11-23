/**
 * What the "Share your win" card says. Pure: the share screen preview, the
 * rendered video and the Stories sticker all read the same lines from here,
 * so what the member sees is exactly what gets shared.
 *
 * Copy rule: every line must make sense to someone who has never heard of
 * Pactara (no "3 of 4 checked in", no crew-only terms).
 */
import type { WeekDayState } from "@/lib/streak-rules";

export type ShareFormat = "story" | "post";
export type ShareCardKind = "workout" | "video";

export type WorkoutCardPrefs = { stats: boolean; pr: boolean; streak: boolean; crew: boolean };
export type VideoCardPrefs = { streak: boolean; crew: boolean; activity: boolean; week: boolean };
export type ShareCardPrefs = { workout: WorkoutCardPrefs; video: VideoCardPrefs };

export const DEFAULT_CARD_PREFS: ShareCardPrefs = {
  workout: { stats: true, pr: true, streak: false, crew: false },
  video: { streak: true, crew: true, activity: false, week: false },
};

export type ShareCardWorkout = {
  title: string;
  minutes: number;
  volume: number;
  unit: "lb" | "kg";
  sets: number;
  pr: { name: string; weight: number; unit: "lb" | "kg"; reps: number } | null;
};

export type ShareCardInput = {
  streak: number;
  /** The crew's display name; `relation` says whether it is a partner pact or a solo pact. */
  crewName: string | null;
  relation?: "crew" | "partner" | "solo";
  /** Activity tag label, e.g. "Workout". */
  activityLabel: string | null;
  week: { done: number; target: number; days: WeekDayState[] } | null;
  /** Set when the check-in posted with a logged workout summary. */
  workout: ShareCardWorkout | null;
};

export type CardLine =
  | { kind: "pill"; text: string }
  | { kind: "kicker"; text: string }
  | { kind: "title"; text: string }
  | { kind: "sub"; text: string; weight: 600 | 700 }
  | { kind: "week"; text: string; days: WeekDayState[] };

export const cardKind = (input: Pick<ShareCardInput, "workout">): ShareCardKind =>
  input.workout ? "workout" : "video";

const NUM = new Intl.NumberFormat("en-US");

export const streakLine = (n: number) => `🔥 Day ${Math.max(1, Math.round(n))} streak`;

export function statsLine(w: ShareCardWorkout): string {
  const parts: string[] = [];
  if (w.minutes > 0) parts.push(`${w.minutes}m`);
  if (w.volume > 0) parts.push(`${NUM.format(w.volume)} ${w.unit}`);
  if (w.sets > 0) parts.push(`${w.sets} ${w.sets === 1 ? "set" : "sets"}`);
  return parts.join(" · ");
}

export function prPillText(pr: NonNullable<ShareCardWorkout["pr"]>): string {
  const name = pr.name.trim();
  return pr.weight > 0
    ? `PR · ${name} ${NUM.format(pr.weight)} ${pr.unit} × ${pr.reps}`
    : `PR · ${name} × ${pr.reps}`;
}

/** "Staying accountable with my …" — names the crew on workout cards only. */
export function crewLine(input: Pick<ShareCardInput, "crewName" | "relation">, named: boolean): string {
  if (input.relation === "partner") return "Staying accountable with my partner";
  if (input.relation === "solo") return "Staying accountable every day";
  const name = (input.crewName ?? "").trim();
  if (!named || !name) return "Staying accountable with my crew";
  return /\bcrew$/i.test(name)
    ? `Staying accountable with my ${name}`
    : `Staying accountable with my ${name} crew`;
}

export function weekLine(week: { done: number; target: number }): string {
  const noun = week.target === 1 ? "workout" : "workouts";
  return `${Math.min(week.done, 7)} of ${week.target} ${noun} this week`;
}

/** The overlay block, top to bottom. */
export function shareCardLines(input: ShareCardInput, prefs: ShareCardPrefs): CardLine[] {
  const lines: CardLine[] = [];
  if (input.workout) {
    const p = prefs.workout;
    const w = input.workout;
    if (p.pr && w.pr) lines.push({ kind: "pill", text: prPillText(w.pr) });
    lines.push({ kind: "title", text: w.title });
    const stats = statsLine(w);
    if (p.stats && stats) lines.push({ kind: "sub", text: stats, weight: 700 });
    if (p.streak) lines.push({ kind: "sub", text: streakLine(input.streak), weight: 700 });
    if (p.crew) lines.push({ kind: "sub", text: crewLine(input, true), weight: 600 });
    return lines;
  }
  const p = prefs.video;
  if (p.activity && input.activityLabel) lines.push({ kind: "kicker", text: input.activityLabel.toUpperCase() });
  const crew = p.crew ? crewLine(input, false) : null;
  if (p.streak) {
    lines.push({ kind: "title", text: streakLine(input.streak) });
    if (crew) lines.push({ kind: "sub", text: crew, weight: 600 });
  } else if (crew) {
    lines.push({ kind: "title", text: crew });
  }
  if (p.week && input.week) lines.push({ kind: "week", text: weekLine(input.week), days: input.week.days });
  return lines;
}

export type CardToggle = { key: string; label: string; hint: string };

/** Switches in "Edit card" for this check-in (New PR only when there is one). */
export function cardToggles(input: ShareCardInput): CardToggle[] {
  if (input.workout) {
    const t: CardToggle[] = [{ key: "stats", label: "Workout stats", hint: statsLine(input.workout) || "Time, weight and sets" }];
    if (input.workout.pr) t.push({ key: "pr", label: "New PR", hint: prPillText(input.workout.pr) });
    t.push({ key: "streak", label: "Streak", hint: streakLine(input.streak) });
    t.push({ key: "crew", label: "Crew line", hint: crewLine(input, true) });
    return t;
  }
  const t: CardToggle[] = [
    { key: "streak", label: "Streak", hint: streakLine(input.streak) },
    { key: "crew", label: "Crew line", hint: crewLine(input, false) },
  ];
  if (input.activityLabel) t.push({ key: "activity", label: "Activity", hint: input.activityLabel.toUpperCase() });
  if (input.week) t.push({ key: "week", label: "This week", hint: weekLine(input.week) });
  return t;
}

const PREFS_KEY = "pactara:share-card";

/** Saved switches, falling back to the defaults for anything missing or bad. */
export function parseCardPrefs(raw: string | null | undefined): ShareCardPrefs {
  const out: ShareCardPrefs = {
    workout: { ...DEFAULT_CARD_PREFS.workout },
    video: { ...DEFAULT_CARD_PREFS.video },
  };
  if (!raw) return out;
  try {
    const v = JSON.parse(raw) as Partial<Record<ShareCardKind, Record<string, unknown>>>;
    for (const kind of ["workout", "video"] as const) {
      const saved = v?.[kind];
      if (!saved || typeof saved !== "object") continue;
      const target = out[kind] as Record<string, boolean>;
      for (const key of Object.keys(target)) {
        if (typeof saved[key] === "boolean") target[key] = saved[key] as boolean;
      }
    }
  } catch {
    /* defaults */
  }
  return out;
}

export function loadCardPrefs(): ShareCardPrefs {
  try {
    return parseCardPrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return parseCardPrefs(null);
  }
}

export function saveCardPrefs(prefs: ShareCardPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode: keep for this screen only */
  }
}

export const shareFileName = (streak: number, kind: "video" | "photo" = "video") =>
  `Pactara - Day ${Math.max(1, Math.round(streak))}.${kind === "photo" ? "jpg" : "mp4"}`;

/** "0:12", "1:05". */
export function formatClipDuration(seconds: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Output frame size: 1080 wide when the clip is sharp enough, else 720. */
export function outputSize(format: ShareFormat, sourceShortSide: number): { width: number; height: number } {
  const width = sourceShortSide >= 1000 ? 1080 : 720;
  return { width, height: format === "story" ? Math.round((width * 16) / 9) : width };
}
