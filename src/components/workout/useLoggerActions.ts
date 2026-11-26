import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { primeRestSound } from "@/components/workout/RestAlarm";
import { endWorkoutWithoutCompleting } from "@/lib/workouts.functions";
import { finishLoggedSession } from "@/lib/lifts.functions";
import { LIFT_HISTORY_KEY, MY_WORKOUTS_KEY, useLiftHistory, type LibraryExercise } from "@/lib/exercise-library";
import {
  buildLiveExercise,
  finishPayload,
  recordQuickPick,
  setActiveWorkout,
  setCounts,
  setFinishedWorkout,
  updateActiveWorkout,
  withPrs,
  type ActiveWorkout,
  type LiveExercise,
  type LiveSet,
} from "@/lib/active-workout";
import { canCheckOffSet, carryLoggedSetForward } from "@/lib/lift-rules";
import { hapticLight } from "@/lib/native";
import { useAppVersion } from "@/hooks/use-app-version";
import { templateFromLogger } from "@/lib/workout-update";

export const update = (fn: (w: ActiveWorkout) => ActiveWorkout) => updateActiveWorkout(fn);
export const updateEx = (key: string, fn: (e: LiveExercise) => LiveExercise) =>
  update((w) => ({ ...w, exercises: w.exercises.map((e) => (e.key === key ? fn(e) : e)) }));

// Where the logger goes once the workout is cleared (finish → done, discard → home).
let exitTo: "/home" | "/workout/done" | null = null;
export function takeExit(): "/home" | "/workout/done" | "/workout" {
  const to = exitTo ?? "/workout";
  exitTo = null;
  return to;
}

/** Logger actions shared by the classic and new-version loggers (same saving path). */
export function useLoggerActions(w: ActiveWorkout) {
  const qc = useQueryClient();
  const { data: history } = useLiftHistory();
  const finishFn = useServerFn(finishLoggedSession);
  const version = useAppVersion();
  const endFn = useServerFn(endWorkoutWithoutCompleting);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleSet = (ex: LiveExercise, set: LiveSet) => {
    primeRestSound();
    void hapticLight();
    const nowIso = new Date().toISOString();
    update((x) => {
      const exercises = x.exercises.map((e) => {
        if (e.key !== ex.key) return e;
        const idx = e.sets.findIndex((s) => s.id === set.id);
        const cur = e.sets[idx];
        if (!cur) return e;
        // An empty set can't be checked off; undoing a done set is always allowed.
        if (!cur.done && !canCheckOffSet(cur, e)) return e;
        let sets = e.sets.map((s) => (s.id === set.id ? { ...s, done: !s.done, doneAt: !s.done ? nowIso : null } : s));
        if (!cur.done) sets = carryLoggedSetForward(sets, idx);
        return withPrs({ ...e, sets }, x.unit);
      });
      let rest = x.rest;
      const changed = exercises.find((y) => y.key === ex.key)?.sets.find((s) => s.id === set.id);
      if (!set.done && changed?.done) {
        const e = exercises.find((y) => y.key === ex.key)!;
        const nextIdx = e.sets.findIndex((s) => !s.done);
        const nextEx = exercises.find((y) => y.key !== ex.key && y.sets.some((s) => !s.done));
        const label = nextIdx >= 0 ? `Rest · next: set ${nextIdx + 1}` : nextEx ? `Rest · next: ${nextEx.name}` : "Rest · all sets done";
        rest = { endsAt: Date.now() + e.restSeconds * 1000, total: e.restSeconds, label, exKey: ex.key };
      }
      return { ...x, exercises, rest, focusKey: x.focusKey === ex.key && exercises.find((y) => y.key === ex.key)!.sets.every((s) => s.done) ? null : x.focusKey };
    });
  };

  /** Adds picked exercises, or swaps one in for `replaceKey`. */
  const addExercises = (picked: LibraryExercise[], replaceKey: string | null) => {
    const built = picked.map((e) => buildLiveExercise(e, history?.byExercise[e.id], { unit: w.unit }));
    if (replaceKey) update((x) => ({ ...x, exercises: x.exercises.map((e) => (e.key === replaceKey ? built[0] ?? e : e)) }));
    else update((x) => ({ ...x, exercises: [...x.exercises, ...built] }));
  };

  /** "empty" = nothing to save; "confirm" = unchecked sets left (unless forced). */
  const finish = async (force = false): Promise<"empty" | "confirm" | "done" | "failed"> => {
    const payload = finishPayload(w);
    if (!payload.length) return "empty";
    const { done, total } = setCounts(w);
    if (!force && done < total) return "confirm";
    setSaving(true);
    setErr(null);
    try {
      const res = await finishFn({
        data: {
          sessionId: w.sessionId,
          groupId: w.groupId,
          title: w.title,
          workoutId: w.workoutId,
          plan: w.plan ? { name: w.plan.planName, week: w.plan.week, day: w.plan.day } : null,
          startedAt: new Date(w.startedAt).toISOString(),
          exercises: payload,
        },
      });
      setFinishedWorkout({
        sessionId: res.sessionId,
        title: w.title,
        workoutId: w.workoutId,
        groupId: w.groupId,
        finishedAt: Date.now(),
        localDate: res.localDate,
        summary: res.summary,
        template: w.exercises
          .filter((e) => e.sets.some((s) => s.done))
          .map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((s) => s.done).length, restSeconds: e.restSeconds, primary: e.primary })),
        ...(version === "new" ? { fullTemplate: templateFromLogger(w.exercises) } : {}),
        plan: w.plan,
      });
      recordQuickPick("logged");
      exitTo = "/workout/done";
      setActiveWorkout(null);
      void qc.invalidateQueries({ queryKey: LIFT_HISTORY_KEY });
      void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
      void qc.invalidateQueries({ queryKey: ["workouts-overview"] });
      void qc.invalidateQueries({ queryKey: ["home-crew"] });
      void qc.invalidateQueries({ queryKey: ["groups-today"] });
      return "done";
    } catch (e) {
      console.error("[workout] finish failed", e);
      setErr("Couldn't save your workout. Check your connection and tap Finish again.");
      return "failed";
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    const sessionId = w.sessionId;
    exitTo = "/home";
    setActiveWorkout(null);
    // Refresh "Working out" on Crew today / crew pages once the session has ended.
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ["home-crew"] });
      void qc.invalidateQueries({ queryKey: ["groups-today"] });
    };
    refresh();
    if (sessionId) endFn({ data: { sessionId } }).catch(() => {}).finally(refresh);
  };

  return { history, toggleSet, addExercises, finish, discard, saving, err };
}
