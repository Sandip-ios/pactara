import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { Play, Plus, X } from "lucide-react";
import { usePlans, useMyPlans } from "@/components/plans/PlanBits";
import { SavedRow, useMyWorkoutsFlow } from "@/components/workout/MyWorkoutsFlow";
import { FONT, W } from "@/components/workout/WorkoutBits";
import { useLiftHistory, useMyWorkouts } from "@/lib/exercise-library";
import { recordQuickPick } from "@/lib/active-workout";
import { plural } from "@/lib/lift-rules";
import { dayForWeek, dayMinutes, movesForWeek, weekNoteFor } from "@/lib/workout-plans";
import { localDateIn } from "@/lib/streak-rules";

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
  const scrollRef = useOpenAtTop();
  const navigate = useNavigate();
  const { data: plans } = usePlans();
  const { data: mine } = useMyPlans();
  const { data: workouts } = useMyWorkouts();
  const { data: history } = useLiftHistory();
  const { lib, start, busy, run, editWorkout, startBuild, overlays } = useMyWorkoutsFlow({
    onSaved: () => scrollRef.current?.scrollTo({ top: 0 }),
  });

  const active = mine?.active ?? null;
  const plan = active ? plans?.find((p) => p.slug === active.slug) ?? null : null;
  const day = plan && active ? dayForWeek(plan, active.nextDay, active.currentWeek) : null;
  const moves = plan && day && active ? movesForWeek(day.moves, weekNoteFor(plan, active.currentWeek)?.lighter ?? false) : [];
  const timezone = history?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = history?.today ?? localDateIn(timezone);

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
          onClick={startBuild}
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

      {overlays}
    </div>
  );
}
