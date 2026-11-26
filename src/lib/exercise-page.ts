/**
 * New-version exercise page (/exercises/$exerciseId): pure rules for the
 * workout tip card, progress tiles, the next target and history rows.
 * Weight progression itself stays in lift-rules.ts.
 */
import type { LibraryExercise } from "@/lib/exercise-library";
import {
  DEFAULT_REPS_HI,
  DEFAULT_REPS_LO,
  bestOf,
  convertWeight,
  fmtDurationShort,
  fmtNum,
  fmtWeight,
  historyDateLabel,
  progression,
  repsLabel,
  type LogType,
  type SetEntry,
  type WeightUnit,
} from "@/lib/lift-rules";

export type ExerciseTab = "howto" | "progress";
export const parseExerciseTab = (v: unknown): ExerciseTab => (v === "progress" ? "progress" : "howto");

export type ProgressSession = { date: string; sets: (SetEntry & { isPr?: boolean })[] };

/** "4 sets of 8", "3 sets of 10 each", "3 sets of 30s", "3 sets". */
export function setsPhrase(item: { sets: number; reps?: string | null; seconds?: number | null }): string {
  const n = Math.max(1, item.sets);
  const base = n === 1 ? "1 set" : `${n} sets`;
  const reps = (item.reps ?? "").trim();
  if (reps) return `${base} of ${reps}`;
  if (item.seconds && item.seconds > 0) return `${base} of ${item.seconds}s`;
  return base;
}

/**
 * Workout tip card: "Maya's tip in Back day:" + "pull to your belly button. 4 sets of 8."
 * Null when the workout has no tip for this exercise.
 */
export function tipCard(input: {
  authorKind: "you" | "member" | "pactara";
  authorName: string;
  workoutName: string;
  tip: string | null | undefined;
  sets: number;
  reps?: string | null;
  seconds?: number | null;
}): { lead: string; body: string } | null {
  let tip = (input.tip ?? "").trim();
  if (!tip) return null;
  // Lowercase the first letter so it reads on from the lead, unless it's an acronym ("RDL").
  if (/^[A-Z][^A-Z]/.test(tip)) tip = tip.charAt(0).toLowerCase() + tip.slice(1);
  if (!/[.!?]$/.test(tip)) tip += ".";
  const first = input.authorName.trim().split(/\s+/)[0] || "Their";
  const who = input.authorKind === "you" ? "Your" : input.authorKind === "pactara" ? "Pactara's" : `${first}'s`;
  return { lead: `${who} tip in ${input.workoutName}:`, body: `${tip} ${setsPhrase(input)}.` };
}

/** Whole weeks the sessions span, counting both ends: weekly sessions over 4 weeks read "5 weeks". */
export function weeksSpanned(firstDate: string, lastDate: string): number {
  const days = Math.max(0, Math.round((Date.parse(`${lastDate}T12:00:00Z`) - Date.parse(`${firstDate}T12:00:00Z`)) / 86400000));
  return Math.floor(days / 7) + 1;
}

export type ProgressStats = {
  /** Heaviest set each session, oldest first, in the member's unit. */
  points: { date: string; w: number }[];
  best: number;
  /** Latest heaviest set minus the first one; null with fewer than 2 weighted sessions. */
  change: number | null;
  weeks: number;
  sessions: number;
};

/** Sessions arrive newest first (getExerciseProgress). */
export function progressStats(sessions: readonly ProgressSession[], unit: WeightUnit): ProgressStats {
  const points = [...sessions].reverse().map((s) => {
    const b = bestOf(s.sets);
    return { date: s.date, w: b ? convertWeight(b.weight, b.unit, unit) : 0 };
  });
  const weighted = points.filter((p) => p.w > 0);
  const best = weighted.reduce((m, p) => Math.max(m, p.w), 0);
  const first = weighted[0];
  const last = weighted[weighted.length - 1];
  const change = first && last && weighted.length > 1 ? Math.round((last.w - first.w) * 100) / 100 : null;
  const weeks = first && last ? weeksSpanned(first.date, last.date) : 0;
  return { points, best, change, weeks, sessions: sessions.length };
}

/** "+40 lb", "−5 lb", "0 lb". */
export const changeLabel = (change: number, unit: WeightUnit) => `${change > 0 ? "+" : change < 0 ? "−" : ""}${fmtNum(Math.abs(change))} ${unit}`;

/**
 * Next time's target from the latest session, using the logger's progression rule:
 * all sets at 12+ → one weight step up and back to 8 reps; otherwise the same weight, aiming for 12.
 */
export function nextTarget(
  latest: ProgressSession | null,
  unit: WeightUnit,
  opts: { logType: LogType; loadable: boolean },
): { weight: number | null; reps: number | null; text: string } | null {
  if (!latest || !latest.sets.length) return null;
  const p = progression({ last: latest, target: null, unit, logType: opts.logType, loadable: opts.loadable });
  if (opts.logType === "reps" && opts.loadable && p.nextWeight != null && p.nextWeight > 0) {
    const reps = p.allTop ? DEFAULT_REPS_LO : DEFAULT_REPS_HI;
    return { weight: p.nextWeight, reps, text: `Next time, try ${fmtWeight(p.nextWeight, unit)} for ${reps}.` };
  }
  return p.tip ? { weight: null, reps: null, text: p.tip } : null;
}

export type HistoryRow = { key: string; date: string; weekday: string; sets: string; pr: boolean };

function setText(s: SetEntry, unit: WeightUnit, timed: boolean): string {
  if (timed) return fmtDurationShort(s.seconds ?? 0);
  if (!s.weight) return repsLabel(s.reps ?? 0);
  return `${fmtNum(convertWeight(s.weight, s.unit, unit))} × ${s.reps ?? 0}`;
}

/** One row per session, newest first: "Nov 23" / "Mon", "135 × 8 · 135 × 8", PR when any set was one. */
export function historyRows(sessions: readonly ProgressSession[], unit: WeightUnit, timed: boolean): HistoryRow[] {
  return [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s, i) => {
      const d = historyDateLabel(s.date);
      return { key: `${s.date}-${i}`, date: d.date, weekday: d.weekday, sets: s.sets.map((x) => setText(x, unit, timed)).join(" · "), pr: s.sets.some((x) => !!x.isPr) };
    });
}

/** "Swap it for": other library versions of the same move (same variation group), closest equipment first. */
export function swapOptions(ex: LibraryExercise, library: readonly LibraryExercise[], limit = 10): LibraryExercise[] {
  if (!ex.variationGroup) return [];
  return library
    .filter((o) => o.id !== ex.id && !o.custom && o.variationGroup === ex.variationGroup)
    .sort((a, b) => Number(a.equipment !== ex.equipment) - Number(b.equipment !== ex.equipment) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
