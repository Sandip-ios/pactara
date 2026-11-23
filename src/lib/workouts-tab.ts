/**
 * Pure rules behind the Workouts tab: this week's tiles, Recent rows and the
 * Your lifts list (best set + change in 30 days). Dates are the member's own
 * local dates (saved timezone); weeks are Mon–Sun via streak-rules.
 */
import { addDaysIso, weekStartIso } from "@/lib/streak-rules";
import { bestOf, convertWeight, fmtNum, plural, repsLabel, type LogType, type SetEntry, type WeightUnit } from "@/lib/lift-rules";

export type LoggedSessionLite = { localDate: string; minutes: number; prs: number };

/** This week's tiles: workouts logged, minutes logged and new PRs, Monday through today. */
export function weekStats(sessions: LoggedSessionLite[], today: string): { workouts: number; minutes: number; prs: number } {
  const start = weekStartIso(today);
  const inWeek = sessions.filter((s) => s.localDate >= start && s.localDate <= today);
  return {
    workouts: inWeek.length,
    minutes: inWeek.reduce((n, s) => n + Math.max(0, Math.round(s.minutes)), 0),
    prs: inWeek.reduce((n, s) => n + Math.max(0, s.prs), 0),
  };
}

/** "1h 53m", "34m", "2h". */
export function fmtLiftTime(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** Recent row meta: "4 exercises · 11 sets · 34 min", or "Build Muscle · week 3 · 41 min" for a plan day. */
export function recentMeta(r: { exercises: number; sets: number; minutes: number; plan: { name: string; week: number } | null }): string {
  const min = `${Math.max(0, Math.round(r.minutes))} min`;
  if (r.plan) return `${r.plan.name} · week ${r.plan.week} · ${min}`;
  return `${plural(r.exercises, "exercise")} · ${plural(r.sets, "set")} · ${min}`;
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAYS_LONG = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** Recent row date column: { weekday: "SUN", day: "22" }. */
export function recentDate(localDate: string): { weekday: string; day: string } {
  const d = at(localDate);
  return { weekday: WEEKDAYS[d.getUTCDay()]!, day: String(d.getUTCDate()) };
}

/** Recent sheet kicker: "SUNDAY, NOV 22 · 34 MIN". */
export function sessionKicker(localDate: string, minutes: number): string {
  const d = at(localDate);
  return `${WEEKDAYS_LONG[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} · ${Math.max(0, Math.round(minutes))} MIN`;
}

export type DatedSet = SetEntry & { localDate: string };

/** "55 lb × 8" (weighted), "22 reps" (bodyweight), "45 sec" (timed), in the member's unit. */
export function bestSetLabel(sets: readonly SetEntry[], unit: WeightUnit, logType: LogType): string | null {
  if (logType === "timed") {
    const s = Math.max(0, ...sets.map((x) => x.seconds ?? 0));
    return s ? `${s} sec` : null;
  }
  const b = bestOf(sets);
  if (!b) return null;
  if (!b.weight) return repsLabel(Math.max(...sets.filter((s) => !s.weight).map((s) => s.reps ?? 0), b.reps));
  return `${fmtNum(convertWeight(b.weight, b.unit, unit))} ${unit} × ${b.reps}`;
}

/** Best rep count on sets with no weight (bodyweight moves). */
const bestReps = (sets: readonly SetEntry[]) => Math.max(0, ...sets.filter((s) => !s.weight).map((s) => s.reps ?? 0));
const bestSeconds = (sets: readonly SetEntry[]) => Math.max(0, ...sets.map((s) => s.seconds ?? 0));

/**
 * How much the best set improved in the last 30 days: "+10 lb", "+4 reps" or
 * "+15 sec". The baseline is the best set from before the 30 days, or (for
 * newer lifts) the first day logged inside them. Null when nothing improved.
 */
export function liftChange30(sets: readonly DatedSet[], today: string, unit: WeightUnit, logType: LogType): string | null {
  if (sets.length === 0) return null;
  const cutoff = addDaysIso(today, -30);
  const recent = sets.filter((s) => s.localDate > cutoff && s.localDate <= today);
  if (recent.length === 0) return null;
  const before = sets.filter((s) => s.localDate <= cutoff);
  let baseline: DatedSet[];
  if (before.length) baseline = before;
  else {
    const first = recent.reduce((m, s) => (s.localDate < m ? s.localDate : m), recent[0]!.localDate);
    baseline = recent.filter((s) => s.localDate === first);
    if (baseline.length === recent.length) return null; // only one day logged
  }
  const all = [...before, ...recent];
  if (logType === "timed") {
    const d = bestSeconds(all) - bestSeconds(baseline);
    return d > 0 ? `+${d} sec` : null;
  }
  const now = bestOf(all);
  const was = bestOf(baseline);
  if (!now || !was) return null;
  if (!now.weight && !was.weight) {
    const d = bestReps(all) - bestReps(baseline);
    return d > 0 ? `+${repsLabel(d)}` : null;
  }
  const dw = convertWeight(now.weight, now.unit, unit) - convertWeight(was.weight, was.unit, unit);
  if (dw > 0.01) return `+${fmtNum(Math.round(dw * 100) / 100)} ${unit}`;
  if (Math.abs(dw) <= 0.01 && now.reps > was.reps) return `+${repsLabel(now.reps - was.reps)}`;
  return null;
}

/** Your lifts: first 3, then all. */
export const LIFTS_SHOWN = 3;
export function liftsToggleLabel(total: number, expanded: boolean): string {
  return expanded ? "Show fewer" : `Show all ${total} lifts`;
}
