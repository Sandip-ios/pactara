/**
 * Workout builder (new version): pure rules for the equipment prefill, the
 * live minutes, reps wording, the dirty check and the save payload.
 * Time comes from workout-builder.ts so it matches the workout page.
 */
import { clampSets, estimateMinutes, moveItem } from "@/lib/workout-builder";
import { TIP_MAX } from "@/lib/new-workout-view";

export type WorkoutEquipment = "gym" | "dumbbells" | "home";
export const EQUIPMENT_OPTIONS: { key: WorkoutEquipment; label: string }[] = [
  { key: "gym", label: "Gym" },
  { key: "dumbbells", label: "Dumbbells" },
  { key: "home", label: "Home" },
];

export type BuilderItem = {
  key: string;
  exerciseId: string;
  sets: number;
  /** "8", "8-12", "10 each"; empty when not set. */
  reps: string;
  tip: string;
  /** Kept as they were (not edited here). */
  restSeconds?: number;
  seconds?: number;
};

export type BuilderState = { workoutId: string | null; name: string; equipment: WorkoutEquipment | null; items: BuilderItem[] };

/**
 * Equipment from the exercises: anything needing a barbell, cable or
 * machine is Gym; else dumbbells or kettlebells are Dumbbells; bodyweight
 * and bands only is Home. Null with no exercises.
 */
export function equipmentFromExercises(equipments: readonly string[]): WorkoutEquipment | null {
  if (!equipments.length) return null;
  if (equipments.some((e) => e === "barbell" || e === "cable" || e === "machine")) return "gym";
  if (equipments.some((e) => e === "dumbbell" || e === "kettlebell")) return "dumbbells";
  return "home";
}

/** "EXERCISES · 45 MIN" minutes, from the builder's estimate. */
export function builderMinutes(items: readonly Pick<BuilderItem, "sets">[]): number {
  return estimateMinutes(items.reduce((a, i) => a + i.sets, 0));
}

/** Reps as typed: trimmed, single spaces, at most 20 characters. */
export function cleanReps(v: string): string {
  return v.trim().replace(/\s+/g, " ").slice(0, 20);
}

/** Reps stepper: moves the leading number by `delta` (min 1, max 100) and keeps " each" etc. */
export function stepReps(v: string, delta: number): string {
  const m = /^(\d+)(.*)$/.exec(cleanReps(v));
  if (!m) return String(Math.max(1, delta > 0 ? 8 : 1));
  const n = Math.max(1, Math.min(100, Number(m[1]) + delta));
  return `${n}${m[2]}`;
}

/** Toggles the " each" (each side) suffix. */
export function toggleEach(v: string): string {
  const r = cleanReps(v) || "10";
  return / each$/i.test(r) ? r.replace(/ each$/i, "") : `${r} each`;
}

/** The pill on each row: "4 × 8", "3 × 10 each", or "3 sets". */
/** Always sets × reps ("4 × 8", "3 × 30s"); "N sets" only for old saved items with neither. */
export function pillText(item: Pick<BuilderItem, "sets" | "reps"> & { seconds?: number }): string {
  const r = cleanReps(item.reps);
  if (r) return `${item.sets} × ${r}`;
  if (item.seconds && item.seconds > 0) return `${item.sets} × ${item.seconds}s`;
  return `${item.sets} sets`;
}

/** A newly added exercise: 3 × 10 reps, or 3 × 30s for timed moves. */
export function newItemDose(logType: "reps" | "timed" | string): { sets: number; reps: string; seconds?: number } {
  return logType === "timed" ? { sets: 3, reps: "", seconds: 30 } : { sets: 3, reps: "10" };
}

export function cleanTip(v: string): string {
  return v.replace(/\s+/g, " ").trimStart().slice(0, TIP_MAX);
}

/** What saveBuiltWorkout receives. */
export function savePayload(s: BuilderState) {
  return {
    workoutId: s.workoutId,
    name: s.name.trim(),
    equipment: s.equipment,
    exercises: s.items.map((i) => {
      const o: { exerciseId: string; sets: number; reps?: string; tip?: string; restSeconds?: number; seconds?: number } = {
        exerciseId: i.exerciseId,
        sets: clampSets(i.sets),
      };
      const reps = cleanReps(i.reps);
      if (reps) o.reps = reps;
      const tip = i.tip.trim().slice(0, TIP_MAX);
      if (tip) o.tip = tip;
      if (i.restSeconds != null) o.restSeconds = i.restSeconds;
      if (i.seconds != null) o.seconds = i.seconds;
      return o;
    }),
  };
}

/** Everything that would be saved, as one comparable string. */
export function builderSignature(s: BuilderState): string {
  const p = savePayload(s);
  return JSON.stringify([p.name, p.equipment, p.exercises]);
}

/** Cancel asks first only when something would be lost. */
export function builderDirty(initial: string, s: BuilderState): boolean {
  return builderSignature(s) !== initial;
}

export function canSaveBuilder(s: Pick<BuilderState, "name" | "items">): boolean {
  return s.name.trim().length > 0 && s.items.length > 0;
}

export const reorderItems = moveItem;
