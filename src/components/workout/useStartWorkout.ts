import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getLiftHistory, startLoggedSession, type SavedWorkout } from "@/lib/lifts.functions";
import { EXERCISE_LIBRARY_KEY, LIFT_HISTORY_KEY, fetchExerciseLibrary } from "@/lib/exercise-library";
import { buildLiveExercise, setActiveWorkout, uid, updateActiveWorkout, type ActiveWorkout, type LiveExercise } from "@/lib/active-workout";
import { parseDose } from "@/lib/lift-rules";
import { checkInActivityFor, dayForWeek, movesForWeek, weekNoteFor, type Plan } from "@/lib/workout-plans";
import type { MyActivePlan } from "@/lib/plans.functions";

const activeGroupId = () => {
  try {
    return localStorage.getItem("active-group-id");
  } catch {
    return null;
  }
};

/** Starts a saved workout or a plan day and opens the logger (only ever on an explicit Start). */
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
    // From the Start screen, replace it so the logger's chevron returns to where you were.
    navigate({ to: "/workout/log", replace: window.location.pathname === "/workout" });
    // The crew sees you working out; fine to fail offline (saved on finish).
    startFn({ data: { groupId: full.groupId, title: full.title, workoutId: full.workoutId } })
      .then(({ sessionId }) => {
        if (sessionId) updateActiveWorkout((x) => (x.id === full.id ? { ...x, sessionId } : x));
      })
      .catch(() => {});
  };

  return {
    async startSaved(workout: SavedWorkout) {
      const { lib, hist } = await load();
      const exercises: LiveExercise[] = [];
      for (const it of workout.exercises) {
        const ex = lib.get(it.exerciseId);
        if (ex) exercises.push(buildLiveExercise(ex, hist.byExercise[ex.id], { unit: hist.unit, count: it.sets, restSeconds: it.restSeconds }));
      }
      begin({ title: workout.name, workoutId: workout.id, unit: hist.unit, plan: null, untracked: [], exercises });
    },
    /**
     * A plan day in the logger with its doses prefilled. Only your plan's next
     * day carries the plan tag (and moves the plan on); any other day you pick
     * logs the same moves as a normal workout.
     */
    async startPlan(plan: Plan, active: MyActivePlan | null, pos?: { week: number; day: number }) {
      const { lib, hist } = await load();
      const week = pos?.week ?? active?.currentWeek ?? 1;
      const dayNumber = pos?.day ?? active?.nextDay ?? 1;
      const day = dayForWeek(plan, dayNumber, week);
      if (!day) return;
      const lighter = weekNoteFor(plan, week)?.lighter ?? false;
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
      const isNext = !!active && active.planId === plan.id && active.currentWeek === week && active.nextDay === dayNumber;
      begin({
        title: day.title,
        workoutId: null,
        unit: hist.unit,
        untracked,
        exercises,
        plan:
          isNext && active
            ? {
                userPlanId: active.id,
                slug: plan.slug,
                planName: plan.name,
                week,
                day: dayNumber,
                activity: checkInActivityFor(day),
              }
            : null,
      });
    },
  };
}
