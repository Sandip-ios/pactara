import type { PostWorkout, PostWorkoutMove } from "./social-post-types";
import type { WorkoutDetail } from "./lifts.functions";
export type PostMeal = {
  title: string;
  items: { name: string; amount: string }[];
  calories: number | null;
  protein: number | null;
};
export const SECTION_PREVIEW_ROWS = 3;
export function postWorkoutSummary(workout: { moves: readonly unknown[]; sets: number; minutes: number }): string {
  const count = workout.moves.length;
  return `${count} ${count === 1 ? "exercise" : "exercises"} · ${workout.sets} ${workout.sets === 1 ? "set" : "sets"}${workout.minutes > 0 ? ` · ${workout.minutes} min` : ""}`;
}
export function sectionPreview<T>(items: T[]) {
  return {
    rows: items.slice(0, SECTION_PREVIEW_ROWS),
    more: items.length > SECTION_PREVIEW_ROWS,
    total: items.length,
  };
}
export function postExerciseDose(move: PostWorkoutMove): string {
  const values = [
    ...new Set(
      move.sets
        .map((s) => (move.logType === "timed" ? s.seconds : s.reps))
        .filter((n): n is number => n !== null),
    ),
  ];
  const dose =
    values.length === 1
      ? String(values[0])
      : values.length
        ? `${Math.min(...values)}–${Math.max(...values)}`
        : "…";
  return `${move.sets.length} × ${dose}${move.logType === "timed" ? " sec" : ""}`;
}
export function mealMacroLine(meal: PostMeal): string {
  const parts = [
    meal.calories !== null ? `${Math.round(meal.calories)} cal` : null,
    meal.protein !== null ? `${Math.round(meal.protein)} g protein` : null,
  ].filter(Boolean);
  return parts.length ? `About ${parts.join(" · ")}` : "";
}
export function postSectionCanSave(isMine: boolean) {
  return !isMine;
}
/** Reuse the post section without carrying check-in weights into its public snapshot. */
export function checkInPostWorkout(detail: WorkoutDetail, fallbackTitle: string): PostWorkout {
  return {
    source: "session",
    title: detail.title || fallbackTitle,
    minutes: detail.summary?.minutes ?? 0,
    sets: detail.summary?.sets ?? detail.exercises.reduce((n, e) => n + e.sets.length, 0),
    prCount: detail.exercises.reduce((n, e) => n + e.sets.filter((s) => s.isPr).length, 0),
    moves: detail.exercises.map((e) => ({
      exerciseId: e.exerciseId, name: e.name, imageStart: e.imageStart, logType: e.logType,
      sets: e.sets.map((s) => ({ reps: s.reps, seconds: s.seconds, isPr: s.isPr })),
    })),
  };
}
export function postWorkoutDetail(w: PostWorkout, isMine: boolean): WorkoutDetail {
  return {
    title: w.title,
    summary: {
      exercises: w.moves.length,
      sets: w.sets,
      minutes: w.minutes,
      volume: 0,
      unit: "kg",
      items: [],
      prs: [],
    },
    exercises: w.moves.map((m) => ({
      exerciseId: m.exerciseId,
      name: m.name,
      imageStart: m.imageStart,
      logType: m.logType,
      equipment: "",
      sets: m.sets.map((s) => ({
        weight: null,
        reps: s.reps,
        seconds: s.seconds,
        unit: "kg" as const,
        isPr: s.isPr,
      })),
    })),
    isMine,
    dayLabel: null,
    savedWorkoutId: null,
  };
}
