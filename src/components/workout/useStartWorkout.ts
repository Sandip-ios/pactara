import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getLiftHistory, startLoggedSession, type SavedWorkout } from "@/lib/lifts.functions";
import { EXERCISE_LIBRARY_KEY, LIFT_HISTORY_KEY, fetchExerciseLibrary, type LibraryExercise } from "@/lib/exercise-library";
import { buildLiveExercise, setActiveWorkout, uid, updateActiveWorkout, type ActiveWorkout, type LiveExercise } from "@/lib/active-workout";
import { parseDose, suggestWorkoutName } from "@/lib/lift-rules";
import { checkInActivityFor, dayForWeek, movesForWeek, weekNoteFor, type Plan } from "@/lib/workout-plans";
import type { MyActivePlan } from "@/lib/plans.functions";

const activeGroupId = () => {
  try {
    return localStorage.getItem("active-group-id");
  } catch {
    return null;
  }
};

/** Builds a workout (new, saved or today's plan day) and opens the logger. */
export function useStartWorkout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const startFn = useServerFn(startLoggedSession);

  const load = async () => {
    const [lib, hist] = await Promise.all([
      qc.ensureQueryData({ queryKey: EXERCISE_LIBRARY_KEY, queryFn: fetchExerciseLibrary }),
      qc.ensureQueryData({ queryKey: LIFT_HISTORY_KEY, queryFn: () => getLiftHistory() }),
    ]);
    return { lib: new Map(lib.map((e) => [e.id, e])), hist };
  };

  const begin = (w: Omit<ActiveWorkout, "v" | "id" | "sessionId" | "startedAt" | "focusKey" | "rest" | "groupId">) => {
    const full: ActiveWorkout = { ...w, v: 1, id: uid(), sessionId: null, startedAt: Date.now(), focusKey: null, rest: null, groupId: activeGroupId() };
    setActiveWorkout(full);
    navigate({ to: "/workout/log" });
    // The crew sees you working out; fine to fail offline (saved on finish).
    startFn({ data: { groupId: full.groupId, title: full.title, workoutId: full.workoutId } })
      .then(({ sessionId }) => {
        if (sessionId) updateActiveWorkout((x) => (x.id === full.id ? { ...x, sessionId } : x));
      })
      .catch(() => {});
  };

  return {
    async startPicked(picked: LibraryExercise[]) {
      const { hist } = await load();
      const exercises = picked.map((e) => buildLiveExercise(e, hist.byExercise[e.id], { unit: hist.unit }));
      begin({ title: suggestWorkoutName(picked), workoutId: null, unit: hist.unit, plan: null, untracked: [], exercises });
    },
    async startSaved(workout: SavedWorkout) {
      const { lib, hist } = await load();
      const exercises: LiveExercise[] = [];
      for (const it of workout.exercises) {
        const ex = lib.get(it.exerciseId);
        if (ex) exercises.push(buildLiveExercise(ex, hist.byExercise[ex.id], { unit: hist.unit, count: it.sets, restSeconds: it.restSeconds }));
      }
      begin({ title: workout.name, workoutId: workout.id, unit: hist.unit, plan: null, untracked: [], exercises });
    },
    async startPlan(plan: Plan, active: MyActivePlan) {
      const { lib, hist } = await load();
      const day = dayForWeek(plan, active.nextDay, active.currentWeek);
      if (!day) return;
      const lighter = weekNoteFor(plan, active.currentWeek)?.lighter ?? false;
      const exercises: LiveExercise[] = [];
      const untracked: { name: string; dose: string }[] = [];
      for (const m of movesForWeek(day.moves, lighter)) {
        const ex = m.exercise_id ? lib.get(m.exercise_id) : undefined;
        if (!ex) {
          untracked.push({ name: m.name, dose: m.dose });
          continue;
        }
        const live = buildLiveExercise(ex, hist.byExercise[ex.id], { unit: hist.unit, target: parseDose(m.dose), isPlan: true });
        exercises.push(live);
      }
      begin({
        title: day.title,
        workoutId: null,
        unit: hist.unit,
        untracked,
        exercises,
        plan: {
          userPlanId: active.id,
          slug: plan.slug,
          planName: plan.name,
          week: active.currentWeek,
          day: active.nextDay,
          activity: checkInActivityFor(day),
        },
      });
    },
  };
}
