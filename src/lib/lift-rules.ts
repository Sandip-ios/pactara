/**
 * Weight tracking rules shared by the workout logger, the done screen, the
 * exercise progress page, server functions and tests. Pure: no I/O.
 */
import type { MuscleRegion } from "@/lib/workout-plans";

export type WeightUnit = "lb" | "kg";
export type Equipment = "dumbbell" | "barbell" | "cable" | "machine" | "bodyweight" | "band" | "kettlebell" | "other";
export type LogType = "reps" | "timed";

export type PickerTab = "all" | "shoulders" | "chest" | "back" | "legs" | "glutes" | "biceps" | "triceps" | "core";

export const PICKER_TABS: { id: PickerTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shoulders", label: "Shoulders" },
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "legs", label: "Legs" },
  { id: "glutes", label: "Glutes" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "core", label: "Core" },
];

export const EQUIPMENT_CHIPS: { id: Equipment | null; label: string }[] = [
  { id: null, label: "Any equipment" },
  { id: "dumbbell", label: "Dumbbell" },
  { id: "barbell", label: "Barbell" },
  { id: "cable", label: "Cable" },
  { id: "machine", label: "Machine" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "band", label: "Band" },
];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  dumbbell: "Dumbbell",
  barbell: "Barbell",
  cable: "Cable",
  machine: "Machine",
  bodyweight: "Bodyweight",
  band: "Band",
  kettlebell: "Kettlebell",
  other: "Other",
};

const REGION_TAB: Record<MuscleRegion, Exclude<PickerTab, "all">> = {
  shoulders: "shoulders",
  chest: "chest",
  back: "back",
  traps: "back",
  biceps: "biceps",
  forearms: "biceps",
  triceps: "triceps",
  abs: "core",
  quads: "legs",
  hamstrings: "legs",
  calves: "legs",
  glutes: "glutes",
};

/** Picker tabs an exercise appears under (from its main muscles). */
export function tabsFor(primary: readonly string[]): Exclude<PickerTab, "all">[] {
  const out: Exclude<PickerTab, "all">[] = [];
  for (const m of primary) {
    const t = REGION_TAB[m as MuscleRegion];
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** The one section an exercise is listed under on the "All" tab. */
export function mainTab(primary: readonly string[]): Exclude<PickerTab, "all"> {
  return tabsFor(primary)[0] ?? "core";
}

export const tabLabel = (t: PickerTab) => PICKER_TABS.find((x) => x.id === t)?.label ?? t;

/** Thumbnail tint group (same palette as plan move tiles). */
export type TintGroup = "CH" | "SH" | "BK" | "LG" | "AR" | "CO" | "GL";
const TAB_TINT: Record<Exclude<PickerTab, "all">, TintGroup> = {
  shoulders: "SH",
  chest: "CH",
  back: "BK",
  legs: "LG",
  glutes: "GL",
  biceps: "AR",
  triceps: "AR",
  core: "CO",
};
export const tintGroupFor = (primary: readonly string[]): TintGroup => TAB_TINT[mainTab(primary)];

// ---------- Units ----------

const LB_PER_KG = 2.20462262;

export function convertWeight(w: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return w;
  const v = from === "kg" ? w * LB_PER_KG : w / LB_PER_KG;
  // lb to the nearest 0.5, kg to the nearest 0.25: what plates and dumbbells come in.
  return to === "lb" ? Math.round(v * 2) / 2 : Math.round(v * 4) / 4;
}

export const toKg = (w: number, unit: WeightUnit) => (unit === "kg" ? w : w / LB_PER_KG);

/** One tap on the − / + pill. */
export const weightStep = (unit: WeightUnit) => (unit === "lb" ? 5 : 2.5);

export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export function fmtWeight(w: number, unit: WeightUnit): string {
  return `${fmtNum(w)} ${unit}`;
}

// ---------- Sets ----------

export type SetEntry = { weight: number | null; reps: number | null; seconds: number | null; unit: WeightUnit };

const kgOf = (s: SetEntry) => toKg(s.weight ?? 0, s.unit);
const EPS = 0.01;

/** Heaviest set (ties: more reps). Only sets with reps count. */
export type Best = { kg: number; reps: number; weight: number; unit: WeightUnit };

export function bestOf(sets: readonly SetEntry[]): Best | null {
  let best: Best | null = null;
  for (const s of sets) {
    if (!s.reps || s.reps <= 0) continue;
    const kg = kgOf(s);
    if (!best || kg > best.kg + EPS || (Math.abs(kg - best.kg) <= EPS && s.reps > best.reps)) {
      best = { kg, reps: s.reps, weight: s.weight ?? 0, unit: s.unit };
    }
  }
  return best;
}

/**
 * A personal best: heavier than the previous best for at least as many reps,
 * or more reps at the same weight. Nothing to beat yet → not a PR.
 */
export function beatsBest(best: Best | null, set: SetEntry): boolean {
  if (!best || !set.reps || set.reps <= 0) return false;
  const kg = kgOf(set);
  if (kg > best.kg + EPS && set.reps >= best.reps) return true;
  return Math.abs(kg - best.kg) <= EPS && set.reps > best.reps;
}

/** PR flags for sets done in order, each compared with everything before it. */
export function markPrs(history: readonly SetEntry[], sets: readonly SetEntry[]): boolean[] {
  let best = bestOf(history);
  return sets.map((s) => {
    const pr = beatsBest(best, s);
    best = bestOf(best ? [{ weight: best.weight, reps: best.reps, seconds: null, unit: best.unit }, s] : [s]);
    return pr;
  });
}

// ---------- Plan doses ----------

export type Target = {
  sets: number;
  repsLo: number | null;
  repsHi: number | null;
  /** Timed moves: seconds per set. */
  seconds: number | null;
};

/** "3x8-12" → 3 sets of 8–12; "3x30 sec" → 3 × 30 s; "20 min" → 1 × 20 min; "2 sets, stop 2 reps short" → 2 sets. */
export function parseDose(dose: string): Target {
  const d = dose.replace(/×/g, "x").replace(/[–—]/g, "-").toLowerCase();
  const m = d.match(/^(\d+)\s*x\s*(\d+)(?:\s*-\s*(\d+))?\s*(sec|min)?/);
  if (m) {
    const sets = Number(m[1]);
    const a = Number(m[2]);
    const b = m[3] ? Number(m[3]) : null;
    if (m[4] === "sec") return { sets, repsLo: null, repsHi: null, seconds: a };
    if (m[4] === "min") return { sets, repsLo: null, repsHi: null, seconds: a * 60 };
    return { sets, repsLo: a, repsHi: b ?? a, seconds: null };
  }
  const setsOnly = d.match(/^(\d+)\s*sets?/);
  if (setsOnly) return { sets: Number(setsOnly[1]), repsLo: null, repsHi: null, seconds: null };
  const onOff = d.match(/^(\d+)\s*sec on/);
  if (onOff) return { sets: 3, repsLo: null, repsHi: null, seconds: Number(onOff[1]) };
  if (/rounds?:/.test(d)) return { sets: 1, repsLo: null, repsHi: null, seconds: null };
  const mins = d.match(/^(\d+)\s*min/);
  if (mins) return { sets: 1, repsLo: null, repsHi: null, seconds: Number(mins[1]) * 60 };
  return { sets: 3, repsLo: null, repsHi: null, seconds: null };
}

// ---------- Prefill and progression ----------

export type LastSession = { date: string; sets: SetEntry[] };

export type Progression = {
  tip: string | null;
  /** Weight to use next (in the member's unit); null when there's nothing to load. */
  nextWeight: number | null;
  /** Hit the top of the range on every set last time. */
  allTop: boolean;
};

const joinReps = (xs: (number | string)[]) => xs.join(", ");

/**
 * The rep goal when there's no plan range: the rep count you did most often
 * (ties go to the higher one). 10, 10, 8 → 10; 10, 10, 11 → 10.
 */
export function repGoal(reps: number[]): number {
  const counts = new Map<number, number>();
  for (const r of reps) if (r > 0) counts.set(r, (counts.get(r) ?? 0) + 1);
  let best = 0;
  let bestCount = 0;
  for (const [r, c] of counts) {
    if (c > bestCount || (c === bestCount && r > best)) {
      best = r;
      bestCount = c;
    }
  }
  return best;
}

/**
 * What to aim for, from the last session of this exercise:
 * top of the range on all sets → go up a step next time.
 * `target` is the plan's dose; without one the top is last time's usual rep count.
 */
export function progression(input: {
  last: LastSession | null;
  target: Target | null;
  unit: WeightUnit;
  logType: LogType;
  loadable: boolean;
}): Progression {
  const { last, target, unit, logType, loadable } = input;
  if (!last || last.sets.length === 0) {
    if (target && target.repsLo && loadable && logType === "reps") {
      const range = target.repsHi && target.repsHi !== target.repsLo ? `${target.repsLo}–${target.repsHi}` : `${target.repsLo}`;
      return { tip: `First time: pick a weight you can lift ${range} times with good form.`, nextWeight: null, allTop: false };
    }
    return { tip: null, nextWeight: null, allTop: false };
  }
  if (logType === "timed") {
    const secs = last.sets.map((s) => s.seconds ?? 0).filter((s) => s > 0);
    if (!secs.length) return { tip: null, nextWeight: null, allTop: false };
    return { tip: `Last time you held ${joinReps(secs.map(fmtDurationShort))}.`, nextWeight: null, allTop: false };
  }
  const reps = last.sets.map((s) => s.reps ?? 0);
  const n = target?.sets ?? last.sets.length;
  const top = target?.repsHi ?? repGoal(reps);
  const counted = reps.slice(0, n);
  const allTop = top > 0 && counted.length >= n && counted.every((r) => r >= top);
  const lastWeight = Math.max(0, ...last.sets.map((s) => (s.weight == null ? 0 : convertWeight(s.weight, s.unit, unit))));
  if (!loadable || lastWeight <= 0) {
    return {
      tip: allTop
        ? `Last time you hit ${joinReps(reps)}. Add a rep or two today.`
        : `Last time you hit ${joinReps(reps)}. Get ${top} on all ${n} sets.`,
      nextWeight: null,
      allTop,
    };
  }
  if (allTop) {
    const next = lastWeight + weightStep(unit);
    return {
      tip: `You hit ${top} on all ${n} sets last time. Go up to ${fmtWeight(next, unit)} today.`,
      nextWeight: next,
      allTop,
    };
  }
  return {
    tip: `Last time you hit ${joinReps(reps)}. Get ${top} on all ${n} sets and go up to ${fmtWeight(lastWeight + weightStep(unit), unit)} next time.`,
    nextWeight: lastWeight,
    allTop,
  };
}

/**
 * Starting values for each set: last session's sets (repeating its last set
 * when there are more sets today). Plan workouts apply the plan's rule, so
 * after hitting the top of the range everywhere the weight goes up a step and
 * the reps restart at the bottom of the range.
 */
export function prefillSets(input: {
  last: LastSession | null;
  target: Target | null;
  unit: WeightUnit;
  logType: LogType;
  loadable: boolean;
  isPlan: boolean;
  count?: number;
}): SetEntry[] {
  const { last, target, unit, logType, loadable, isPlan } = input;
  const count = input.count ?? target?.sets ?? (last?.sets.length || 3);
  const prog = progression({ last, target, unit, logType, loadable });
  const bump = isPlan && prog.allTop && prog.nextWeight != null;
  const out: SetEntry[] = [];
  for (let i = 0; i < count; i++) {
    const src = last?.sets[i] ?? last?.sets[last.sets.length - 1] ?? null;
    const lastW = src?.weight != null && src.weight > 0 ? convertWeight(src.weight, src.unit, unit) : null;
    if (logType === "timed") {
      out.push({ weight: loadable ? lastW : null, reps: null, seconds: src?.seconds ?? target?.seconds ?? null, unit });
      continue;
    }
    const reps = bump ? (target?.repsLo ?? src?.reps ?? null) : (src?.reps ?? target?.repsLo ?? null);
    out.push({ weight: bump ? prog.nextWeight : lastW, reps, seconds: null, unit });
  }
  return out;
}

/** Exercise progress page: "Next time: 40 lb. You got 10 reps on all 3 sets today." */
export function nextTimeTip(last: LastSession | null, unit: WeightUnit): { text: string; weight: number | null } | null {
  if (!last || !last.sets.length) return null;
  const p = progression({ last, target: null, unit, logType: "reps", loadable: true });
  const reps = last.sets.map((s) => s.reps ?? 0);
  const top = repGoal(reps);
  if (p.nextWeight == null) return null;
  if (p.allTop) {
    return { text: `Next time: ${fmtWeight(p.nextWeight, unit)}. You got ${top} reps on all ${reps.length} sets today.`, weight: p.nextWeight };
  }
  return { text: `Next time: stay at ${fmtWeight(p.nextWeight, unit)}. Aim for ${top} reps on all ${reps.length} sets.`, weight: p.nextWeight };
}

// ---------- Labels ----------

export function fmtDurationShort(sec: number): string {
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60} min`;
  if (sec >= 60) return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} min`;
  return `${sec} sec`;
}

/** "24:10", or "1:02:10" past an hour. */
export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "35 lb × 10, 10, 8" (one weight) or "35 × 10, 40 × 8"; timed: "30 sec, 30 sec". */
export function setsShort(sets: readonly SetEntry[], unit: WeightUnit, logType: LogType = "reps"): string {
  if (!sets.length) return "";
  if (logType === "timed") return sets.map((s) => fmtDurationShort(s.seconds ?? 0)).join(", ");
  const ws = sets.map((s) => (s.weight == null || s.weight <= 0 ? 0 : convertWeight(s.weight, s.unit, unit)));
  const reps = sets.map((s) => s.reps ?? 0);
  if (ws.every((w) => w === 0)) return `${joinReps(reps)} reps`;
  if (ws.every((w) => w === ws[0])) return `${fmtWeight(ws[0]!, unit)} × ${joinReps(reps)}`;
  return sets.map((_, i) => `${fmtNum(ws[i]!)} × ${reps[i]}`).join(", ");
}

/** Picker row: "Last: 35 lb × 10" (top set of the last session) or "Never done". */
export function lastSetLabel(last: LastSession | null, unit: WeightUnit, logType: LogType = "reps"): string {
  if (!last || !last.sets.length) return "Never done";
  if (logType === "timed") return `Last: ${fmtDurationShort(Math.max(...last.sets.map((s) => s.seconds ?? 0)))}`;
  const top = bestOf(last.sets);
  if (!top) return "Never done";
  if (!top.weight) return `Last: ${top.reps} reps`;
  return `Last: ${fmtWeight(convertWeight(top.weight, top.unit, unit), unit)} × ${top.reps}`;
}

/** "35×10" in the LAST column. */
export function lastCell(s: SetEntry | null, unit: WeightUnit, logType: LogType): string {
  if (!s) return "—";
  if (logType === "timed") return s.seconds ? fmtDurationShort(s.seconds).replace(" sec", "s").replace(" min", "m") : "—";
  if (!s.weight) return s.reps ? `${s.reps}` : "—";
  return `${fmtNum(convertWeight(s.weight, s.unit, unit))}×${s.reps ?? 0}`;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Workout done kicker, "SHOULDER DAY · SUNDAY". `localDate` is the member's own
 * calendar day (saved timezone), so the phone clock never decides the weekday.
 */
export function doneKicker(title: string, localDate: string | null | undefined): string {
  if (!localDate) return title.toUpperCase();
  const d = new Date(`${localDate}T12:00:00Z`);
  return `${title} · ${WEEKDAY_LONG[d.getUTCDay()]}`.toUpperCase();
}

/** Exercise history row: { date: "Nov 3", weekday: "Mon" } for a stored member-local YYYY-MM-DD. */
export function historyDateLabel(localDate: string): { date: string; weekday: string } {
  const d = new Date(`${localDate}T12:00:00Z`);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    weekday: WEEKDAY[d.getUTCDay()]!,
  };
}
/** "Thu" for a YYYY-MM-DD within the last week, else "Nov 3". */
export function shortDay(date: string, today: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff > 1 && diff < 7) return WEEKDAY[d.getUTCDay()]!;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Shoulder day" → "SD". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "W";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

const DAY_NAME: Record<Exclude<PickerTab, "all">, string> = {
  shoulders: "Shoulder day",
  chest: "Chest day",
  back: "Back day",
  legs: "Leg day",
  glutes: "Glute day",
  biceps: "Arm day",
  triceps: "Arm day",
  core: "Core day",
};

/** Suggested name for a new workout: the muscle most of its exercises work. */
export function suggestWorkoutName(exercises: { primary: readonly string[] }[]): string {
  const counts = new Map<string, number>();
  for (const e of exercises) {
    const name = DAY_NAME[mainTab(e.primary)];
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best = "Workout";
  let n = 0;
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v];
  return best;
}

// ---------- Totals ----------

export type DoneSet = SetEntry & { done: boolean };

export function workoutTotals(
  exercises: { logType: LogType; sets: DoneSet[] }[],
  minutes: number,
  unit: WeightUnit,
): { exercises: number; sets: number; minutes: number; volume: number } {
  let ex = 0;
  let sets = 0;
  let volume = 0;
  for (const e of exercises) {
    const done = e.sets.filter((s) => s.done);
    if (done.length) ex++;
    sets += done.length;
    if (e.logType === "reps") {
      for (const s of done) volume += (s.weight ? convertWeight(s.weight, s.unit, unit) : 0) * (s.reps ?? 0);
    }
  }
  return { exercises: ex, sets, minutes: Math.max(0, Math.round(minutes)), volume: Math.round(volume) };
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "3 exercises · 9 sets · 38 min" */
export function summaryLine(s: { exercises: number; sets: number; minutes: number }): string {
  return `${plural(s.exercises, "exercise")} · ${plural(s.sets, "set")} · ${s.minutes} min`;
}

// ---------- "Just check in with a video" memory ----------

export const QUICK_CHECKIN_LIMIT = 3;

/** Counts video-only picks in a row; logging a workout resets it for good. */
export function nextQuickPick(state: { streak: number; everLogged: boolean }, pick: "video" | "logged") {
  if (pick === "logged") return { streak: 0, everLogged: true };
  return { streak: state.streak + 1, everLogged: state.everLogged };
}

/** ⚡ goes straight to the camera after 3 video-only picks in a row by someone who never logs. */
export const skipsStartScreen = (state: { streak: number; everLogged: boolean }) =>
  !state.everLogged && state.streak >= QUICK_CHECKIN_LIMIT;
