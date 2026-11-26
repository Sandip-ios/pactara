import { parseRepTarget, progression } from "./lift-rules";
/** Pure rules for the new-version workout logger (rest timer, rows, header line). */
import type { ActiveWorkout, LiveSet } from "@/lib/active-workout";

export type Rest = NonNullable<ActiveWorkout["rest"]>;

/** Seconds left on a rest, rounded up; 0 once it has run out. */
export function restSecondsLeft(rest: Rest | null, now: number): number {
  return rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
}

/**
 * −15s / +15s on the running rest only (the exercise's own rest time is untouched).
 * Taking it to zero or below ends the rest.
 */
export function adjustRest(rest: Rest | null, deltaSeconds: number, now: number): Rest | null {
  if (!rest) return null;
  const endsAt = rest.endsAt + deltaSeconds * 1000;
  if (endsAt - now <= 0) return null;
  return { ...rest, endsAt, total: Math.max(1, rest.total + deltaSeconds) };
}

/** Skip clears the rest. */
export const skipRest = (): Rest | null => null;

/** Sets not checked off, for the Finish confirm. */
export function uncheckedSets(w: Pick<ActiveWorkout, "exercises">): number {
  let n = 0;
  for (const e of w.exercises) n += e.sets.filter((s) => !s.done).length;
  return n;
}

export function uncheckedLine(n: number): string {
  return n === 1 ? "1 set isn't checked. It won't be saved." : `${n} sets aren't checked. They won't be saved.`;
}

export const LOGGER_COLORS = { warm: "#F0EDE8", mint: "#DCFCE7", green: "#16A34A" } as const;

/** How a set row looks: done rows turn their boxes mint and the check solid green. */
export function setRowState(set: Pick<LiveSet, "done" | "pr">) {
  return {
    done: set.done,
    boxBg: set.done ? LOGGER_COLORS.mint : LOGGER_COLORS.warm,
    checkBg: set.done ? LOGGER_COLORS.green : LOGGER_COLORS.warm,
    showPr: set.done && set.pr,
  };
}

/** Live elapsed time: m:ss under an hour (mm:ss from 10 minutes), h:mm:ss after. */
export function fmtElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "from Maya · 18:42", "from your plan · 18:42", or just the time for your own workout. */
export function loggerSubtitle(from: string | null | undefined, elapsedSeconds: number): string {
  const t = fmtElapsed(elapsedSeconds);
  return from ? `from ${from} · ${t}` : t;
}

/** The progression hint the new logger shows: built from the item's reps goal or the plan dose when there is one, else the stored tip. */
export function newLoggerTip(
  ex: Pick<import("./active-workout").LiveExercise, "tip" | "repsGoal" | "target" | "last" | "logType" | "loadable">,
  unit: import("./lift-rules").WeightUnit,
): string | null {
  const goal = parseRepTarget(ex.repsGoal) ?? (ex.target?.repsLo && ex.target.repsHi ? { lo: ex.target.repsLo, hi: ex.target.repsHi } : null);
  if (!goal || !ex.last?.sets.length || ex.logType === "timed") return ex.tip;
  return progression({ last: ex.last, target: ex.target, unit, logType: ex.logType, loadable: ex.loadable, repTarget: goal }).tip ?? ex.tip;
}
