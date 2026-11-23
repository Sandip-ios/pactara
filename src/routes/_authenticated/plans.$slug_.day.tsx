import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Info, Play, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TrialEndedPaywall } from "@/components/TrialEndedPaywall";
import { SwitchPlanSheet } from "@/components/plans/PlanSheets";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { getActiveWorkout } from "@/lib/active-workout";
import { useExerciseMap, type LibraryExercise } from "@/lib/exercise-library";
import { hasActiveMembership } from "@/lib/membership";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { startPlan, type MyActivePlan, type MyPlans } from "@/lib/plans.functions";
import { formatPlanDose, levelChip, planDayBlocks, planDayKicker, resolvePlanDayPosition } from "@/lib/plan-day-view";
import { dayForWeek, dayMinutes, movesForWeek, scheduleForWeek, weekNoteFor, type Plan, type PlanMove } from "@/lib/workout-plans";
import { gearText, useMyPlans, usePlans } from "@/components/plans/PlanBits";

type DaySearch = { week?: number; day?: number };
const toInt = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export const Route = createFileRoute("/_authenticated/plans/$slug_/day")({
  validateSearch: (s: Record<string, unknown>): DaySearch => {
    const out: DaySearch = {};
    const week = toInt(s["week"]);
    const day = toInt(s["day"]);
    if (week) out.week = week;
    if (day) out.day = day;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Plan workout · Pactara" },
      { name: "description", content: "Every move for this plan day, with sets, reps and rest, and how to do each one." },
      { property: "og:title", content: "Plan workout · Pactara" },
      { property: "og:description", content: "Every move for this plan day, with sets, reps and rest, and how to do each one." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanDayPage,
});

const C = {
  bg: "#F4F2EF",
  ink: "#141218",
  stone: "#57534E",
  stoneDark: "#44403C",
  violet: "#6D28D9",
  divider: "#F0EDE9",
  line: "#E7E3DE",
  infoBg: "#EEF2FF",
  infoInk: "#312E81",
  demoDark: "#1C1A22",
  font: "Inter, system-ui, sans-serif",
} as const;

/** One plan day as a full page. Viewing is free; "Start workout" keeps the plan paywall rule. */
function PlanDayPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const startPlanFn = useServerFn(startPlan);
  const starter = useStartWorkout();
  const { data: plans, isLoading } = usePlans();
  const { data: mine } = useMyPlans();
  const { map } = useExerciseMap();
  const [busy, setBusy] = useState(false);
  const [pickDay, setPickDay] = useState(false);
  const [paywall, setPaywall] = useState<{ firstName: string | null } | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const scrollRef = useOpenAtTop();

  const plan = (plans ?? []).find((p) => p.slug === slug) ?? null;
  const active = mine?.active ?? null;
  const onThisPlan = !!plan && !!active && active.planId === plan.id;

  const back = () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/plans/$slug", params: { slug } });
  };

  if (!plan) {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-8 text-center" style={{ background: C.bg, fontFamily: C.font }}>
        {isLoading ? null : (
          <div>
            <div className="text-[17px] font-bold">This plan isn't available</div>
            <button
              type="button"
              onClick={() => navigate({ to: "/groups", search: { tab: "plans" }, replace: true })}
              className="mt-3 h-11 rounded-full bg-white px-5 text-[15px] font-semibold"
              style={{ color: C.violet }}
            >
              See all plans
            </button>
          </div>
        )}
      </div>
    );
  }

  const pos = resolvePlanDayPosition(search, plan, onThisPlan && active ? { week: active.currentWeek, day: active.nextDay } : null);
  const day = dayForWeek(plan, pos.day, pos.week);
  const lighter = !!weekNoteFor(plan, pos.week)?.lighter;
  const moves = day ? movesForWeek(day.moves, lighter) : [];
  const blocks = day ? planDayBlocks(moves, dayMinutes(day, plan)) : [];
  const chips = day ? [`${dayMinutes(day, plan)} min`, levelChip(plan.level), plan.gearShort ?? gearText(plan)] : [];

  const launch = async (a: MyActivePlan | null) => {
    await starter.startPlan(plan, a, pos);
  };

  const beginPlanThenLaunch = async () => {
    setBusy(true);
    try {
      await startPlanFn({ data: { planId: plan.id } });
      await qc.invalidateQueries({ queryKey: ["my-plans"] });
      void qc.invalidateQueries({ queryKey: ["crew-plans"] });
      const fresh = qc.getQueryData<MyPlans>(["my-plans"])?.active ?? null;
      await launch(fresh && fresh.planId === plan.id ? fresh : null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the plan. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // Same rule as "Start this plan": joining a plan needs a trial or membership.
  const onStart = async () => {
    if (busy || !day) return;
    if (getActiveWorkout()) {
      navigate({ to: "/workout/log" });
      return;
    }
    if (onThisPlan) {
      setBusy(true);
      try {
        await launch(active);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      if (!(await hasActiveMembership(uid))) {
        const first = ((auth.user?.user_metadata?.name as string | undefined) ?? "").split(" ")[0] || null;
        setPaywall({ firstName: first });
        return;
      }
    } finally {
      setBusy(false);
    }
    if (active) setConfirmSwitch(true);
    else await beginPlanThenLaunch();
  };

  return (
    <div ref={scrollRef} className="fixed inset-0 w-full overflow-y-auto overscroll-none" data-scroll-root style={{ background: C.bg, fontFamily: C.font, color: C.ink }}>
      <div className="flex flex-col gap-4 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: 130 }}>
        <header className="flex items-center justify-between">
          <button type="button" onClick={back} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white" style={{ color: C.ink }}>
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => setPickDay(true)}
            className="flex h-11 items-center gap-1.5 rounded-full border-none bg-white px-[14px] text-[14px] font-semibold"
            style={{ color: C.ink }}
          >
            <RotateCw size={16} aria-hidden />
            Change workout
          </button>
        </header>

        {!day ? (
          <p className="px-1 text-[15px]" style={{ color: C.stone }}>
            This day isn't part of the plan.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5 px-1">
              <div className="text-[12px] font-bold tracking-[0.6px]" style={{ color: C.violet }}>
                {planDayKicker(plan.name, pos.week, pos.day)}
              </div>
              <h1 className="m-0 text-[28px] font-extrabold leading-tight tracking-[-0.5px]">{day.title}</h1>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span key={c} className="rounded-full bg-white px-2.5 py-1.5 text-[13px] font-semibold leading-none">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-[14px] px-[14px] py-3 text-[14px] leading-[1.45]" style={{ background: C.infoBg, color: C.infoInk }}>
              <Info size={18} className="mt-px shrink-0" aria-hidden />
              <span>New to a move? Tap it to see how it's done, step by step.</span>
            </div>

            {blocks.map((b) => (
              <section key={b.kind} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between px-1">
                  <div className="text-[13px] font-bold tracking-[0.6px]" style={{ color: C.stone }}>
                    {b.label}
                  </div>
                  <div className="text-[13px]" style={{ color: C.stone }}>
                    {b.meta}
                  </div>
                </div>
                <div className="overflow-hidden rounded-[18px] bg-white">
                  {b.moves.map((m, i) => (
                    <MoveRow key={`${m.name}-${i}`} move={m} ex={m.exercise_id ? map.get(m.exercise_id) ?? null : null} first={i === 0} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 bg-white px-4 pt-[14px]"
        style={{ borderTop: `1px solid ${C.line}`, paddingBottom: "max(30px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => void onStart()}
          disabled={busy || !day}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[28px] text-[17px] font-bold text-white disabled:opacity-70"
          style={{ background: C.violet }}
        >
          <Play size={18} fill="currentColor" aria-hidden />
          {busy ? "One moment…" : "Start workout"}
        </button>
        <div className="text-center text-[12px]" style={{ color: C.stone }}>
          When you finish, check in with a quick video.
        </div>
      </div>

      <DayPicker
        open={pickDay}
        onClose={() => setPickDay(false)}
        plan={plan}
        week={pos.week}
        selected={pos.day}
        upNext={onThisPlan && active && active.currentWeek === pos.week ? active.nextDay : null}
        onPick={(d) => {
          setPickDay(false);
          navigate({ to: "/plans/$slug/day", params: { slug }, search: { week: pos.week, day: d }, replace: true });
        }}
      />

      <SwitchPlanSheet
        open={confirmSwitch}
        toName={plan.name}
        current={active}
        onClose={() => setConfirmSwitch(false)}
        onSwitch={() => {
          setConfirmSwitch(false);
          void beginPlanThenLaunch();
        }}
      />

      {paywall && (
        <TrialEndedPaywall
          firstName={paywall.firstName}
          mode="intro"
          onDismiss={() => {
            setPaywall(null);
            // Bought from the paywall? Carry straight on.
            void (async () => {
              const { data: auth } = await supabase.auth.getUser();
              if (auth.user && (await hasActiveMembership(auth.user.id))) {
                if (active) setConfirmSwitch(true);
                else await beginPlanThenLaunch();
              }
            })();
          }}
        />
      )}
    </div>
  );
}

function MoveRow({ move, ex, first }: { move: PlanMove; ex: LibraryExercise | null; first: boolean }) {
  const body = (
    <>
      <MoveTile ex={ex} />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-[15px] font-bold">{move.name}</span>
        {move.plain && (
          <span className={ex ? "line-clamp-2 text-[13px]" : "text-[13px]"} style={{ color: C.stoneDark }}>
            {move.plain}
          </span>
        )}
        <span className="text-[13px] font-semibold" style={{ color: C.violet }}>
          {formatPlanDose(move.dose)}
        </span>
      </span>
    </>
  );
  const cls = "flex items-center gap-3 px-[14px] py-3";
  const style = { color: C.ink, borderTop: first ? undefined : `1px solid ${C.divider}` };
  if (!ex) return <div className={cls} style={style}>{body}</div>;
  return (
    <Link to="/exercises/$exerciseId/how-to" params={{ exerciseId: ex.id }} className={cls} style={style} aria-label={`How to do ${move.name}`}>
      {body}
      <ChevronRight size={20} className="shrink-0" style={{ color: "#A8A29E" }} aria-hidden />
    </Link>
  );
}

/** RepDB start picture with a DEMO label; the dark play tile only when there's no library match. */
function MoveTile({ ex }: { ex: LibraryExercise | null }) {
  if (ex?.imageStart) {
    return (
      <span className="relative flex h-16 w-16 flex-none overflow-hidden rounded-[12px]" style={{ background: C.bg }} aria-hidden>
        <img src={ex.imageStart} alt="" loading="lazy" className="h-full w-full object-cover" style={{ transform: "scale(1.4)", transformOrigin: "center" }} />
        <span className="absolute bottom-1 left-1 rounded-[5px] px-[5px] py-px text-[9px] font-bold text-white" style={{ background: "rgba(20,18,24,.6)" }}>
          DEMO
        </span>
      </span>
    );
  }
  return (
    <span className="relative flex h-16 w-16 flex-none items-center justify-center rounded-[12px] text-white" style={{ background: C.demoDark }} aria-hidden>
      <Play size={22} fill="currentColor" />
      <span className="absolute bottom-1 left-1 rounded-[5px] px-[5px] py-px text-[9px] font-bold text-white" style={{ background: "rgba(255,255,255,0.18)" }}>
        DEMO
      </span>
    </span>
  );
}

function DayPicker({
  open,
  onClose,
  plan,
  week,
  selected,
  upNext,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  week: number;
  selected: number;
  upNext: number | null;
  onPick: (day: number) => void;
}) {
  const days = scheduleForWeek(plan, week);
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} shouldScaleBackground={false}>
      <DrawerContent
        className="max-h-[85dvh] rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]"
        style={{ fontFamily: C.font, color: C.ink }}
      >
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pt-3">
          <div className="flex flex-col gap-0.5">
            <DrawerTitle className="text-[20px] font-extrabold tracking-tight">Change workout</DrawerTitle>
            <DrawerDescription className="text-[13px]" style={{ color: C.stone }}>
              {plan.name} · Week {week}
            </DrawerDescription>
          </div>
          <div className="overflow-hidden rounded-[16px]" style={{ border: `1.5px solid ${C.line}` }}>
            {days.map((d, i) => {
              const isSel = d.dayNumber === selected;
              return (
                <button
                  key={d.dayNumber}
                  type="button"
                  onClick={() => onPick(d.dayNumber)}
                  aria-pressed={isSel}
                  className="flex min-h-[64px] w-full items-center gap-3 px-[14px] py-3 text-left"
                  style={{ borderTop: i ? `1px solid ${C.divider}` : undefined, background: isSel ? "#FBF9FF" : undefined }}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[12px] font-extrabold tracking-[0.5px]" style={{ color: C.violet }}>
                      DAY {d.dayNumber}
                      {upNext === d.dayNumber ? " · UP NEXT" : ""}
                    </span>
                    <span className="text-[16px] font-bold leading-tight">{d.title}</span>
                    <span className="text-[13px]" style={{ color: C.stone }}>
                      {d.moves.length} {d.moves.length === 1 ? "move" : "moves"} · {dayMinutes(d, plan)} min
                    </span>
                  </span>
                  {isSel && <Check size={20} className="shrink-0" style={{ color: C.violet }} aria-hidden />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full shrink-0 rounded-full bg-white text-[15px] font-bold"
            style={{ border: `1.5px solid ${C.line}`, color: C.ink }}
          >
            Cancel
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
