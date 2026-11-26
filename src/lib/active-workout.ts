/**
 * The workout being logged right now. Lives on the device (localStorage) so it
 * survives minimizing, switching screens and app restarts; the sets are saved
 * to the backend once, when the workout is finished.
 */
import { useSyncExternalStore } from "react";
import type { LibraryExercise } from "@/lib/exercise-library";
import type { ExerciseHistory, WorkoutSummary } from "@/lib/lifts.functions";
import type { PlanCheckIn } from "@/lib/plan-checkin";
import {
  markPrs,
  nextQuickPick,
  prefillSets,
  progression,
  skipsStartScreen,
  type Equipment,
  type LastSession,
  type LogType,
  type SetEntry,
  type Target,
  type WeightUnit,
} from "@/lib/lift-rules";

export type LiveSet = {
  id: string;
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  done: boolean;
  doneAt: string | null;
  pr: boolean;
};

export type LiveExercise = {
  key: string;
  exerciseId: string;
  name: string;
  equipment: Equipment;
  logType: LogType;
  primary: string[];
  imageStart: string | null;
  /** Takes a weight (bodyweight moves can still add one by typing it in). */
  loadable: boolean;
  /** Timed moves of 5 minutes or more are logged in minutes. */
  minutes: boolean;
  restSeconds: number;
  notes: string;
  tip: string | null;
  /** The workout author's own tip for this exercise (new-version logger shows it). */
  authorTip?: string | null;
  /** The saved workout item's reps goal ("5", "8-12"); the new-version logger builds its hint from it. */
  repsGoal?: string | null;
  target: Target | null;
  last: LastSession | null;
  /** Heaviest set before today, for live personal bests. */
  best: SetEntry | null;
  sets: LiveSet[];
};

export type ActiveWorkout = {
  v: 1;
  id: string;
  sessionId: string | null;
  title: string;
  workoutId: string | null;
  groupId: string | null;
  startedAt: number;
  unit: WeightUnit;
  plan: PlanCheckIn | null;
  /** Where it came from, for the new logger header ("Maya", "your plan"); null for your own. */
  from?: string | null;
  /** Plan moves with no library match: shown, not logged. */
  untracked: { name: string; dose: string }[];
  exercises: LiveExercise[];
  focusKey: string | null;
  rest: { endsAt: number; total: number; label: string; exKey: string } | null;
};

const KEY = "pactara:active-workout";
const listeners = new Set<() => void>();
let cache: ActiveWorkout | null | undefined;

function read(): ActiveWorkout | null {
  if (cache !== undefined) return cache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const v = raw ? (JSON.parse(raw) as ActiveWorkout) : null;
    // A workout left open for more than 12 hours was abandoned.
    cache = v && v.v === 1 && Date.now() - v.startedAt < 12 * 3600_000 ? v : null;
  } catch {
    cache = null;
  }
  return cache;
}

function write(v: ActiveWorkout | null) {
  cache = v;
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  for (const l of listeners) l();
}

export const getActiveWorkout = read;
export const setActiveWorkout = write;

export function updateActiveWorkout(fn: (w: ActiveWorkout) => ActiveWorkout) {
  const cur = read();
  if (cur) write(fn(cur));
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = undefined;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useActiveWorkout(): ActiveWorkout | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const liveSet = (s: SetEntry): LiveSet => ({
  id: uid(),
  weight: s.weight,
  reps: s.reps,
  seconds: s.seconds,
  done: false,
  doneAt: null,
  pr: false,
});

/** A logger card for one exercise, prefilled from its last session. */
export function buildLiveExercise(
  ex: LibraryExercise,
  hist: ExerciseHistory | undefined,
  opts: { unit: WeightUnit; target?: Target | null; isPlan?: boolean; count?: number; restSeconds?: number },
): LiveExercise {
  const target = opts.target ?? null;
  const logType: LogType = target?.seconds != null ? "timed" : target?.repsLo != null ? "reps" : ex.logType;
  const loadable = ex.equipment !== "bodyweight" && ex.equipment !== "band";
  const last = hist?.last ?? null;
  const prog = progression({ last, target, unit: opts.unit, logType, loadable });
  const sets = prefillSets({ last, target, unit: opts.unit, logType, loadable, isPlan: !!opts.isPlan, count: opts.count });
  const minutes = logType === "timed" && (ex.category === "cardio" || (target?.seconds ?? 0) >= 300);
  return {
    key: uid(),
    exerciseId: ex.id,
    name: ex.name,
    equipment: ex.equipment,
    logType,
    primary: ex.primary,
    imageStart: ex.imageStart,
    loadable,
    minutes,
    restSeconds: opts.restSeconds ?? (logType === "timed" ? 60 : 90),
    notes: "",
    tip: prog.tip,
    target,
    last,
    best: hist?.best ?? null,
    sets: sets.map(liveSet),
  };
}

export function emptySet(ex: LiveExercise): LiveSet {
  const prev = ex.sets[ex.sets.length - 1];
  return { id: uid(), weight: prev?.weight ?? null, reps: prev?.reps ?? null, seconds: prev?.seconds ?? null, done: false, doneAt: null, pr: false };
}

const asEntry = (s: LiveSet, unit: WeightUnit): SetEntry => ({ weight: s.weight, reps: s.reps, seconds: s.seconds, unit });

/** Re-marks personal bests on an exercise's checked sets, in the order they were done. */
export function withPrs(ex: LiveExercise, unit: WeightUnit): LiveExercise {
  if (ex.logType !== "reps") return ex;
  const done = ex.sets.filter((s) => s.done).sort((a, b) => (a.doneAt ?? "").localeCompare(b.doneAt ?? ""));
  const flags = markPrs(ex.best ? [ex.best] : [], done.map((s) => asEntry(s, unit)));
  const prById = new Map(done.map((s, i) => [s.id, flags[i] ?? false]));
  return { ...ex, sets: ex.sets.map((s) => ({ ...s, pr: s.done ? prById.get(s.id) ?? false : false })) };
}

/** The exercise being worked on: the first with an unchecked set (or the one tapped). */
export function currentKey(w: ActiveWorkout): string | null {
  if (w.focusKey && w.exercises.some((e) => e.key === w.focusKey && e.sets.some((s) => !s.done))) return w.focusKey;
  return w.exercises.find((e) => e.sets.some((s) => !s.done))?.key ?? null;
}

export function setCounts(w: ActiveWorkout) {
  let done = 0;
  let total = 0;
  for (const e of w.exercises) {
    total += e.sets.length;
    done += e.sets.filter((s) => s.done).length;
  }
  return { done, total };
}

/** What gets saved: checked sets that have reps or time. */
export function finishPayload(w: ActiveWorkout) {
  return w.exercises
    .map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets
        .filter((s) => s.done && ((s.reps ?? 0) > 0 || (s.seconds ?? 0) > 0))
        .map((s) => ({ weight: s.weight, unit: w.unit, reps: e.logType === "reps" ? s.reps : null, seconds: e.logType === "timed" ? s.seconds : null, doneAt: s.doneAt ?? new Date().toISOString() })),
    }))
    .filter((e) => e.sets.length > 0);
}

// ---------- The finished workout, for the done screen ----------

export type FinishedWorkout = {
  sessionId: string | null;
  title: string;
  workoutId: string | null;
  groupId: string | null;
  finishedAt: number;
  /** YYYY-MM-DD in the member's saved timezone when it finished. */
  localDate?: string;
  summary: WorkoutSummary;
  template: { exerciseId: string; sets: number; restSeconds: number; primary: string[] }[];
  /** New version only: every exercise left in the logger, sets = set rows. */
  fullTemplate?: { exerciseId: string; name: string; sets: number; restSeconds: number; primary: string[] }[];
  plan: PlanCheckIn | null;
};

const DONE_KEY = "pactara:finished-workout";

export function setFinishedWorkout(v: FinishedWorkout) {
  try {
    sessionStorage.setItem(DONE_KEY, JSON.stringify(v));
  } catch {
    /* noop */
  }
}

export function getFinishedWorkout(): FinishedWorkout | null {
  try {
    const raw = sessionStorage.getItem(DONE_KEY);
    return raw ? (JSON.parse(raw) as FinishedWorkout) : null;
  } catch {
    return null;
  }
}

export function clearFinishedWorkout() {
  try {
    sessionStorage.removeItem(DONE_KEY);
  } catch {
    /* noop */
  }
}

// ---------- The logged workout a check-in is posted with ----------

export type WorkoutCheckIn = { sessionId: string; title: string; line: string };
const CHECKIN_KEY = "pactara:workout-checkin";

export function setWorkoutCheckIn(v: WorkoutCheckIn) {
  try {
    sessionStorage.setItem(CHECKIN_KEY, JSON.stringify({ ...v, at: Date.now() }));
  } catch {
    /* noop */
  }
}

export function getWorkoutCheckIn(): WorkoutCheckIn | null {
  try {
    const raw = sessionStorage.getItem(CHECKIN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as WorkoutCheckIn & { at: number };
    if (!v.sessionId || Date.now() - v.at > 6 * 3600_000) {
      sessionStorage.removeItem(CHECKIN_KEY);
      return null;
    }
    return { sessionId: v.sessionId, title: v.title, line: v.line };
  } catch {
    return null;
  }
}

export function clearWorkoutCheckIn() {
  try {
    sessionStorage.removeItem(CHECKIN_KEY);
  } catch {
    /* noop */
  }
}

// ---------- "Just check in with a video" memory ----------

const QUICK_KEY = "pactara:quick-checkin";
type QuickState = { streak: number; everLogged: boolean };

function readQuick(): QuickState {
  try {
    const v = JSON.parse(localStorage.getItem(QUICK_KEY) ?? "null") as QuickState | null;
    return v && typeof v.streak === "number" ? v : { streak: 0, everLogged: false };
  } catch {
    return { streak: 0, everLogged: false };
  }
}

export function recordQuickPick(pick: "video" | "logged") {
  try {
    localStorage.setItem(QUICK_KEY, JSON.stringify(nextQuickPick(readQuick(), pick)));
  } catch {
    /* noop */
  }
}

/** True once someone has picked video-only 3 times in a row and never logged. */
export function checkInSkipsStartScreen(): boolean {
  return skipsStartScreen(readQuick());
}

const CAMERA_DIRECT_KEY = "pactara:camera-direct";
export function markCameraDirect(on: boolean) {
  try {
    if (on) sessionStorage.setItem(CAMERA_DIRECT_KEY, "1");
    else sessionStorage.removeItem(CAMERA_DIRECT_KEY);
  } catch {
    /* noop */
  }
}
export function cameraOpenedDirect(): boolean {
  try {
    return sessionStorage.getItem(CAMERA_DIRECT_KEY) === "1";
  } catch {
    return false;
  }
}
