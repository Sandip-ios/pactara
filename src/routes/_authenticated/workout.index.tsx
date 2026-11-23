import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { endWorkoutWithoutCompleting } from "@/lib/workouts.functions";
import { deleteSavedWorkout, saveBuiltWorkout } from "@/lib/lifts.functions";
import { toast } from "sonner";
import { Play, Plus, X } from "lucide-react";
import { usePlans, useMyPlans } from "@/components/plans/PlanBits";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { ConfirmSheet } from "@/components/workout/ConfirmSheet";
import { WorkoutBuilder } from "@/components/workout/WorkoutBuilder";
import { FONT, W, tintFor } from "@/components/workout/WorkoutBits";
import { MY_WORKOUTS_KEY, useExerciseMap, useLiftHistory, useMyWorkouts, type LibraryExercise } from "@/lib/exercise-library";
import { getActiveWorkout, recordQuickPick, setActiveWorkout, uid } from "@/lib/active-workout";
import { initials, plural, shortDay, suggestWorkoutName } from "@/lib/lift-rules";
import { clampSets, defaultSets, discardBody, draftChanged, draftSignature, pickedIdsOf, sortMyWorkouts, syncPicks, type DraftItem } from "@/lib/workout-builder";
import { dayForWeek, dayMinutes, movesForWeek, weekNoteFor } from "@/lib/workout-plans";
import { localDateIn } from "@/lib/streak-rules";
import type { SavedWorkout } from "@/lib/lifts.functions";

export const Route = createFileRoute("/_authenticated/workout/")({
  head: () => ({
    meta: [
      { title: "Start a workout · Pactara" },
      { name: "description", content: "Start your plan day, a saved workout, or build a new one." },
      { property: "og:title", content: "Start a workout · Pactara" },
      { property: "og:description", content: "Start your plan day, a saved workout, or build a new one." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StartWorkout,
});

type Draft = {
  mode: "new" | "edit";
  workoutId: string | null;
  /** The saved name (for the delete sheet). */
  savedName: string;
  name: string;
  nameTouched: boolean;
  items: DraftItem[];
  /** Edit workout: what it looked like when opened (to spot unsaved changes). */
  initial: string;
};

function StartWorkout() {
  const scrollRef = useOpenAtTop();
  const navigate = useNavigate();
  const { data: plans } = usePlans();
  const { data: mine } = useMyPlans();
  const { data: workouts } = useMyWorkouts();
  const { data: history } = useLiftHistory();
  const { map: lib } = useExerciseMap();
  const start = useStartWorkout();
  const qc = useQueryClient();
  const endFn = useServerFn(endWorkoutWithoutCompleting);
  const saveFn = useServerFn(saveBuiltWorkout);
  const deleteFn = useServerFn(deleteSavedWorkout);
  // "build": choosing exercises for a new workout; "append": adding to the one being built.
  const [picking, setPicking] = useState<null | "build" | "append">(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Leave the builder; ask first when that would lose unsaved changes.
  const leaveBuilder = () => {
    if (draft && draftChanged(draft)) {
      toast.dismiss(); // a "saved" message would sit on top of the sheet
      setConfirmLeave(true);
    }
    else setDraft(null);
  };
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<null | (() => Promise<void>)>(null);

  const active = mine?.active ?? null;
  const plan = active ? plans?.find((p) => p.slug === active.slug) ?? null : null;
  const day = plan && active ? dayForWeek(plan, active.nextDay, active.currentWeek) : null;
  const moves = plan && day && active ? movesForWeek(day.moves, weekNoteFor(plan, active.currentWeek)?.lighter ?? false) : [];
  const timezone = history?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = history?.today ?? localDateIn(timezone);

  // Starting another workout while one is open asks first.
  const run = (fn: () => Promise<void>) => {
    if (busy) return;
    const go = async () => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    };
    if (getActiveWorkout()) setPending(() => go);
    else void go();
  };

  const freshItem = (exerciseId: string): DraftItem => ({
    key: uid(),
    exerciseId,
    sets: defaultSets(lib.get(exerciseId)?.equipment ?? ""),
  });
  const named = (d: Draft): Draft =>
    d.nameTouched ? d : { ...d, name: d.items.length ? suggestWorkoutName(d.items.map((i) => ({ primary: lib.get(i.exerciseId)?.primary ?? [] }))) : d.name };
  const updateItems = (fn: (items: DraftItem[]) => DraftItem[]) => setDraft((d) => (d ? named({ ...d, items: fn(d.items) }) : d));

  const onPicked = (picked: LibraryExercise[]) => {
    const ids = picked.map((e) => e.id);
    if (picking === "append") {
      updateItems((items) => [...items, ...ids.map(freshItem)]);
    } else {
      setDraft((d) =>
        named(
          d
            ? { ...d, items: syncPicks(d.items, ids, freshItem) }
            : { mode: "new", workoutId: null, savedName: "", name: "", nameTouched: false, items: ids.map(freshItem), initial: "" },
        ),
      );
    }
    setSaveErr(null);
    setPicking(null);
  };

  const editWorkout = (wk: SavedWorkout) => {
    setSaveErr(null);
    const items = wk.exercises
      .filter((e) => lib.has(e.exerciseId))
      .map((e) => {
        const it: DraftItem = { key: uid(), exerciseId: e.exerciseId, sets: clampSets(e.sets) };
        if (e.restSeconds != null) it.restSeconds = e.restSeconds;
        return it;
      });
    // Compare against what was saved, so a capped set count or a dropped move counts as a change.
    const savedItems = wk.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets }));
    setDraft({
      mode: "edit",
      workoutId: wk.id,
      savedName: wk.name,
      name: wk.name,
      nameTouched: true,
      items,
      initial: draftSignature(wk.name, savedItems),
    });
  };

  const putInList = (wk: SavedWorkout) => {
    qc.setQueryData<SavedWorkout[]>(MY_WORKOUTS_KEY, (old) => sortMyWorkouts([wk, ...(old ?? []).filter((x) => x.id !== wk.id)]));
    void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
  };

  const persist = async (): Promise<SavedWorkout | null> => {
    if (!draft || saving) return null;
    setSaving(true);
    setSaveErr(null);
    try {
      const { workout } = await saveFn({
        data: {
          workoutId: draft.workoutId,
          name: draft.name.trim(),
          exercises: draft.items.map((i) => (i.restSeconds != null ? { exerciseId: i.exerciseId, sets: i.sets, restSeconds: i.restSeconds } : { exerciseId: i.exerciseId, sets: i.sets })),
        },
      });
      putInList(workout);
      return workout;
    } catch (e) {
      console.error("[workout] save failed", e);
      setSaveErr("Couldn't save the workout. Check your connection and try again.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveOnly = async () => {
    const wk = await persist();
    if (!wk) return;
    setDraft(null);
    scrollRef.current?.scrollTo({ top: 0 });
    toast(`${wk.name} saved`);
  };

  const saveAndStart = async () => {
    const wk = await persist();
    if (!wk) return;
    setDraft(null);
    run(() => start.startSaved(wk));
  };

  const removeWorkout = async () => {
    const d = draft;
    setDeleting(false);
    if (!d?.workoutId) return;
    setSaving(true);
    try {
      await deleteFn({ data: { workoutId: d.workoutId } });
      qc.setQueryData<SavedWorkout[]>(MY_WORKOUTS_KEY, (old) => (old ?? []).filter((x) => x.id !== d.workoutId));
      void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
      setDraft(null);
      toast(`${d.savedName} deleted`);
    } catch (e) {
      console.error("[workout] delete failed", e);
      setSaveErr("Couldn't delete the workout. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/home" });
  };

  return (
    <div ref={scrollRef} className="fixed inset-0 overflow-y-auto pb-10" style={{ background: W.bg, color: W.ink, fontFamily: FONT }} data-scroll-root>
      <header className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+4px)]">
        <h1 className="text-[26px] font-extrabold tracking-[-0.6px]">Start a workout</h1>
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="flex h-11 w-11 items-center justify-center rounded-[22px] bg-white"
          style={{ boxShadow: "0 1px 2px rgba(20,18,24,.06)" }}
        >
          <X size={20} />
        </button>
      </header>
      <div className="flex flex-col gap-[22px] px-4 pt-[18px]">
        {plan && day && active && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => start.startPlan(plan, active))}
            className="flex flex-col gap-3.5 rounded-[20px] p-[18px] text-left text-white"
            style={{ background: W.violetDeep }}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: "#DDD6FE" }}>
                YOUR PLAN · WEEK {active.currentWeek} · DAY {active.nextDay}
              </span>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "rgba(255,255,255,.16)" }}>
                {plan.name}
              </span>
            </span>
            <span className="flex items-end justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[22px] font-extrabold leading-tight">{day.title}</span>
                <span className="block text-[14px]" style={{ color: "#EDE9FE" }}>
                  {plural(moves.length, "exercise")} · about {dayMinutes(day, plan)} min
                </span>
              </span>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: W.violetDeep }}>
                <Play size={20} fill="currentColor" />
              </span>
            </span>
          </button>
        )}

        {workouts && workouts.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[17px] font-extrabold">My workouts</h2>
              <span className="text-[13px]" style={{ color: W.stone }}>
                Tap a name to edit
              </span>
            </div>
            <div className="overflow-hidden rounded-[20px] bg-white">
              {workouts.map((wk, i) => (
                <SavedRow
                  key={wk.id}
                  workout={wk}
                  lib={lib}
                  today={today}
                  timezone={timezone}
                  first={i === 0}
                  disabled={busy}
                  onEdit={() => editWorkout(wk)}
                  onStart={() => run(() => start.startSaved(wk))}
                />
              ))}
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={() => {
            setDraft(null);
            setPicking("build");
          }}
          className="flex items-center gap-3.5 rounded-[20px] p-4 text-left"
          style={{ border: `2px dashed ${W.lilac}`, background: W.tintRow }}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white" style={{ background: W.purple }}>
            <Plus size={22} />
          </span>
          <span>
            <span className="block text-[16px] font-extrabold">Build a workout</span>
            <span className="block text-[13px]" style={{ color: W.stone }}>
              Pick exercises by muscle. Save it to reuse next time.
            </span>
          </span>
        </button>

        <div className="flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => {
              recordQuickPick("video");
              navigate({ to: "/check-in" });
            }}
            className="min-h-11 px-4 text-[15px] font-bold"
            style={{ color: W.violet }}
          >
            Just check in with a video
          </button>
          <span className="text-[12px]" style={{ color: W.muted }}>
            No logging. Counts the same for your streak.
          </span>
        </div>
      </div>

      {draft && (
        <WorkoutBuilder
          mode={draft.mode}
          name={draft.name}
          onName={(v) => setDraft((d) => (d ? { ...d, name: v, nameTouched: true } : d))}
          items={draft.items}
          onItems={updateItems}
          lib={lib}
          busy={saving}
          error={saveErr}
          onBack={() => {
            if (draft.mode === "new") setPicking("build");
            else leaveBuilder();
          }}
          onAddExercises={() => setPicking("append")}
          onSave={() => void saveOnly()}
          onStart={() => void saveAndStart()}
          onDelete={() => {
            toast.dismiss();
            setDeleting(true);
          }}
        />
      )}
      <ExercisePicker
        open={!!picking}
        initialPicked={picking === "build" && draft ? pickedIdsOf(draft.items) : undefined}
        hint="In the order you picked. You can reorder on the next screen."
        onClose={() => {
          // Closing the picker after going back from New workout would drop it: ask first.
          const leaving = picking === "build";
          setPicking(null);
          if (leaving) leaveBuilder();
        }}
        onDone={onPicked}
      />
      <ConfirmSheet
        open={confirmLeave}
        title="Discard changes?"
        body={discardBody(draft ? (draft.mode === "edit" ? draft.savedName : draft.name) : "")}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        cancelOutlined
        danger
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          setDraft(null);
        }}
      />
      <ConfirmSheet
        open={deleting}
        title={`Delete “${draft?.savedName ?? ""}”?`}
        body="It comes off My workouts. Your logged sets and personal bests stay in your history."
        confirmLabel="Delete workout"
        cancelLabel="Keep it"
        cancelOutlined
        danger
        onCancel={() => setDeleting(false)}
        onConfirm={() => void removeWorkout()}
      />
      <ConfirmSheet
        open={!!pending}
        title={`${getActiveWorkout()?.title ?? "A workout"} is still open`}
        body="Start this one instead? The open workout won't be saved."
        confirmLabel="Discard it and start"
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const go = pending;
          const replaced = getActiveWorkout()?.sessionId ?? null;
          setPending(null);
          setActiveWorkout(null);
          // End the replaced workout first so crews stop seeing it as "Working out".
          const ended = replaced ? endFn({ data: { sessionId: replaced } }).catch(() => {}) : Promise.resolve();
          void ended.then(() => {
            void qc.invalidateQueries({ queryKey: ["home-crew"] });
            void qc.invalidateQueries({ queryKey: ["groups-today"] });
            return go?.();
          });
        }}
      />
    </div>
  );
}

function SavedRow({
  workout,
  lib,
  today,
  timezone,
  first,
  disabled,
  onEdit,
  onStart,
}: {
  workout: SavedWorkout;
  lib: Map<string, LibraryExercise>;
  today: string;
  timezone: string;
  first: boolean;
  disabled: boolean;
  onEdit: () => void;
  onStart: () => void;
}) {
  const primaries = workout.exercises.flatMap((e) => lib.get(e.exerciseId)?.primary.slice(0, 1) ?? []);
  const t = tintFor(primaries.length ? [mostCommon(primaries)] : []);
  const lastDone = workout.lastDoneAt ? shortDay(localDateIn(timezone, new Date(workout.lastDoneAt)), today) : null;
  return (
    <div className="flex min-h-[72px] w-full items-center gap-1 pr-3" style={{ borderTop: first ? undefined : `1px solid ${W.divider}` }}>
      <button
        type="button"
        aria-label={`Edit ${workout.name}`}
        disabled={lib.size === 0}
        onClick={onEdit}
        className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 text-left"
      >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[13px] font-extrabold" style={{ background: t.tint, color: t.ink }} aria-hidden>
        {initials(workout.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold">{workout.name}</span>
        <span className="block text-[13px]" style={{ color: W.stone }}>
          {plural(workout.exercises.length, "exercise")}
          {lastDone ? ` · last done ${lastDone}` : ""}
        </span>
      </span>
      </button>
      <button type="button" disabled={disabled} onClick={onStart} aria-label={`Start ${workout.name}`} className="flex h-11 shrink-0 items-center px-1">
        <span className="flex h-9 items-center rounded-[18px] px-3.5 text-[14px] font-bold" style={{ background: W.tint, color: W.violet }}>
          Start
        </span>
      </button>
    </div>
  );
}

function mostCommon(xs: string[]): string {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? xs[0]!;
}
