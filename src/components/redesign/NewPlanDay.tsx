import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BodyMap } from "@/components/plans/BodyMap";
import { useMyPlans, usePlans } from "@/components/plans/PlanBits";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { getActiveWorkout } from "@/lib/active-workout";
import { useExerciseMap, type LibraryExercise } from "@/lib/exercise-library";
import { getMyGroupStatus } from "@/lib/groups.functions";
import { muscleLegend, newPlanDayLabel, newPlanDayMeta, shortDose } from "@/lib/new-plan-day-view";
import { resolvePlanDayPosition } from "@/lib/plan-day-view";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useToastAbove } from "@/lib/toast-offset";
import { dayForWeek, dayMinutes, movesForWeek, weekNoteFor, type MuscleMap, type PlanMove } from "@/lib/workout-plans";

const PURPLE = "#7C3AED";
const AMBER = "#F59E0B";
const INK = "#1C1917";
const MUTED = "#78716C";
const HAIR = "#F0EDE9";
const FONT = "Inter, system-ui, sans-serif";

/**
 * New-version plan day. Only your active plan's next day carries the plan tag
 * (useStartWorkout decides); any other day starts as a normal workout.
 */
export function NewPlanDay({ slug, search }: { slug: string; search: { week?: number; day?: number } }) {
  const navigate = useNavigate();
  const router = useRouter();
  const starter = useStartWorkout();
  const { data: plans, isLoading } = usePlans();
  const { data: mine } = useMyPlans();
  const { map } = useExerciseMap();
  const { data: status } = useQuery({ queryKey: ["my-group-status"], queryFn: () => getMyGroupStatus(), staleTime: 60_000 });
  const [busy, setBusy] = useState(false);
  const scrollRef = useOpenAtTop();
  const actionRef = useRef<HTMLButtonElement>(null);

  const plan = (plans ?? []).find((p) => p.slug === slug) ?? null;
  const active = mine?.active ?? null;
  useToastAbove(actionRef, !!plan);
  const onThisPlan = !!plan && !!active && active.planId === plan.id;
  const back = () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/plans/$slug", params: { slug } });
  };

  if (!plan) {
    return <div className="fixed inset-0 flex items-center justify-center text-[16px] font-bold" style={{ background: "#F5F2EC", color: INK }}>{isLoading ? null : "This plan isn't available"}</div>;
  }

  const pos = resolvePlanDayPosition(search, plan, onThisPlan && active ? { week: active.currentWeek, day: active.nextDay } : null);
  const day = dayForWeek(plan, pos.day, pos.week);
  const note = weekNoteFor(plan, pos.week);
  const moves = day ? movesForWeek(day.moves, !!note?.lighter) : [];
  const isNext = onThisPlan && !!active && active.currentWeek === pos.week && active.nextDay === pos.day;
  const crew = status?.hasGroup ? status.group?.name ?? null : null;

  const onStart = async () => {
    if (busy || !day) return;
    if (getActiveWorkout()) {
      navigate({ to: "/workout/log" });
      return;
    }
    setBusy(true);
    try {
      await starter.startPlan(plan, onThisPlan ? active : null, pos);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={scrollRef} data-scroll-root className="fixed inset-0 overflow-y-auto overscroll-none" style={{ background: "#F5F2EC", color: INK, fontFamily: FONT }}>
      <div className="bg-white px-4 pb-3 pt-new-top">
        <header className="relative flex h-11 items-center">
          <button type="button" onClick={back} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#F0EDE8", color: INK }}>
            <ChevronLeft size={24} />
          </button>
          <h1 className="pointer-events-none absolute inset-x-14 text-center text-[17px] font-bold">Week {pos.week} · Day {pos.day}</h1>
        </header>
      </div>
      <div className="flex flex-col px-4" style={{ paddingBottom: "calc(150px + env(safe-area-inset-bottom) + var(--workout-bar-pad, 0px))" }}>
        {!day ? (
          <p className="mt-6 text-[15px]" style={{ color: MUTED }}>This day isn't part of the plan.</p>
        ) : (
          <>
            <div className="mt-[18px] text-[12px] font-extrabold tracking-[0.6px]" style={{ color: PURPLE }}>{newPlanDayLabel(plan.name, isNext)}</div>
            <h2 className="mt-1 text-[26px] font-extrabold leading-tight tracking-[-0.4px]">{day.title}</h2>
            <p className="mt-1 line-clamp-2 text-[14px] leading-[1.4]" style={{ color: MUTED }}>{newPlanDayMeta(moves.length, dayMinutes(day, plan), note?.note)}</p>

            <WhatItWorks muscles={day.muscles ?? {}} />

            <div className="mt-6 mb-2 text-[12px] font-extrabold tracking-[0.6px]" style={{ color: MUTED }}>EXERCISES</div>
            <div className="overflow-hidden rounded-[18px] bg-white">
              {moves.map((m, i) => (
                <MoveRow key={`${m.name}-${i}`} move={m} ex={m.exercise_id ? map.get(m.exercise_id) ?? null : null} first={i === 0} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 px-4 pt-3" style={{ fontFamily: FONT, background: "linear-gradient(to bottom, rgba(245,242,236,0), #F5F2EC 18px)", bottom: "var(--workout-bar-pad, 0px)", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <button ref={actionRef} type="button" onClick={() => void onStart()} disabled={busy || !day} className="h-[52px] w-full rounded-full text-[17px] font-bold text-white disabled:opacity-60" style={{ background: PURPLE }}>
          {busy ? "One moment…" : onThisPlan ? "Start workout" : "Start this workout"}
        </button>
        {crew && <p className="text-center text-[13px]" style={{ color: MUTED }}>When you finish, checking in to {crew} takes 5 seconds.</p>}
      </div>
    </div>
  );
}

function WhatItWorks({ muscles }: { muscles: MuscleMap }) {
  const legend = muscleLegend(muscles);
  return (
    <section className="mt-5 flex items-center gap-4 rounded-[18px] bg-white p-4">
      <div className="shrink-0">
        <BodyMap muscles={muscles} width={116} height={150} tone="new" />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="text-[16px] font-extrabold">What it works</h3>
        {legend.primary && <LegendRow color={PURPLE} text={legend.primary} />}
        {legend.secondary && <LegendRow color={AMBER} text={legend.secondary} />}
      </div>
    </section>
  );
}

function LegendRow({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-start gap-2 text-[13px] font-medium leading-[1.35]" style={{ color: "#44403C" }}>
      <span className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden />
      <span>{text}</span>
    </div>
  );
}

function MoveRow({ move, ex, first }: { move: PlanMove; ex: LibraryExercise | null; first: boolean }) {
  const body = (
    <>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px]" style={{ background: ex?.imageBg ?? "#E8F1FB" }} aria-hidden>
        {ex?.imageStart && <img src={ex.imageStart} alt="" loading="lazy" className="h-full w-full object-contain" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16px] font-bold">{move.name}</span>
        <span className="text-[13px]" style={{ color: MUTED }}>{shortDose(move.dose)}</span>
      </span>
    </>
  );
  const cls = "flex h-[72px] items-center gap-3 px-3.5";
  const style = { color: INK, borderTop: first ? undefined : `1px solid ${HAIR}` };
  if (!ex) return <div className={cls} style={style}>{body}</div>;
  return (
    <Link to="/exercises/$exerciseId" params={{ exerciseId: ex.id }} search={{ tab: "howto" }} className={cls} style={style} aria-label={`How to do ${move.name}`}>
      {body}
      <ChevronRight size={20} className="shrink-0" style={{ color: "#A8A29E" }} aria-hidden />
    </Link>
  );
}
