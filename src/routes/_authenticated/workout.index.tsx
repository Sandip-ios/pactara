import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Play, Plus, X } from "lucide-react";
import { usePlans, useMyPlans } from "@/components/plans/PlanBits";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { ConfirmSheet } from "@/components/workout/ConfirmSheet";
import { FONT, W, tintFor } from "@/components/workout/WorkoutBits";
import { useExerciseMap, useLiftHistory, useMyWorkouts, type LibraryExercise } from "@/lib/exercise-library";
import { getActiveWorkout, recordQuickPick, setActiveWorkout } from "@/lib/active-workout";
import { initials, plural, shortDay } from "@/lib/lift-rules";
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

function StartWorkout() {
  const navigate = useNavigate();
  const { data: plans } = usePlans();
  const { data: mine } = useMyPlans();
  const { data: workouts } = useMyWorkouts();
  const { data: history } = useLiftHistory();
  const { map: lib } = useExerciseMap();
  const start = useStartWorkout();
  const [picking, setPicking] = useState(false);
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

  const close = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/home" });
  };

  return (
    <div className="fixed inset-0 overflow-y-auto pb-10" style={{ background: W.bg, color: W.ink, fontFamily: FONT }} data-scroll-root>
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
                Saved by you
              </span>
            </div>
            <div className="overflow-hidden rounded-[20px] bg-white">
              {workouts.map((wk, i) => (
                <SavedRow key={wk.id} workout={wk} lib={lib} today={today} timezone={timezone} first={i === 0} disabled={busy} onStart={() => run(() => start.startSaved(wk))} />
              ))}
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={() => setPicking(true)}
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

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onDone={(picked: LibraryExercise[]) => {
          setPicking(false);
          run(() => start.startPicked(picked));
        }}
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
          setPending(null);
          setActiveWorkout(null);
          void go?.();
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
  onStart,
}: {
  workout: SavedWorkout;
  lib: Map<string, LibraryExercise>;
  today: string;
  timezone: string;
  first: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const primaries = workout.exercises.flatMap((e) => lib.get(e.exerciseId)?.primary.slice(0, 1) ?? []);
  const t = tintFor(primaries.length ? [mostCommon(primaries)] : []);
  const lastDone = workout.lastDoneAt ? shortDay(localDateIn(timezone, new Date(workout.lastDoneAt)), today) : null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onStart}
      className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3.5 text-left"
      style={{ borderTop: first ? undefined : `1px solid ${W.divider}` }}
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
      <span className="flex h-9 shrink-0 items-center rounded-[18px] px-3.5 text-[14px] font-bold" style={{ background: W.tint, color: W.violet }}>
        Start
      </span>
    </button>
  );
}

function mostCommon(xs: string[]): string {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? xs[0]!;
}
