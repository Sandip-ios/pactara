import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, TrendingUp, HeartPulse } from "lucide-react";
import { setPlanCheckIn } from "@/lib/plan-checkin";
import { useState } from "react";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { getActiveWorkout } from "@/lib/active-workout";
import { checkInActivityFor, dayForWeek, movesForWeek, weekNoteFor } from "@/lib/workout-plans";
import { BG, Chip, FONT, INK, MUTED, MoveList, PURPLE, PURPLE_SOFT, useMyPlans, usePlans } from "@/components/plans/PlanBits";

export const Route = createFileRoute("/_authenticated/plans/$slug_/day")({
  head: () => ({
    meta: [
      { title: "Today's plan workout · Pactara" },
      { name: "description", content: "Your next workout plan day on Pactara." },
    ],
  }),
  component: PlanDayPage,
});

/** The next plan day (days unlock in order). "Done, check in" posts it through the normal check-in. */
function PlanDayPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const starter = useStartWorkout();
  const [starting, setStarting] = useState(false);
  const { data: plans, isLoading } = usePlans();
  const { data: mine, isLoading: mineLoading } = useMyPlans();
  const plan = (plans ?? []).find((p) => p.slug === slug) ?? null;
  const active = mine?.active && mine.active.slug === slug ? mine.active : null;
  const day = plan && active ? dayForWeek(plan, active.nextDay, active.currentWeek) : null;

  const back = () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/plans/$slug", params: { slug } });
  };

  if (isLoading || mineLoading) return <div className="fixed inset-0" style={{ background: BG }} />;

  if (!plan || !active || !day) {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-8 text-center" style={{ background: BG, fontFamily: FONT }}>
        <div>
          <div className="text-[17px] font-bold">You're not on this plan right now</div>
          <button
            type="button"
            onClick={() => navigate({ to: "/plans/$slug", params: { slug }, replace: true })}
            className="mt-3 h-11 rounded-full px-5 text-[15px] font-semibold"
            style={{ background: PURPLE_SOFT, color: PURPLE }}
          >
            See the plan
          </button>
        </div>
      </div>
    );
  }

  const doneCheckIn = () => {
    setPlanCheckIn({
      userPlanId: active.id,
      slug: plan.slug,
      planName: plan.name,
      week: active.currentWeek,
      day: active.nextDay,
      activity: checkInActivityFor(day),
    });
    navigate({ to: "/check-in" });
  };

  // Log today's plan day set by set; finishing still checks in like "Done, check in".
  const startLogging = async () => {
    if (getActiveWorkout()) return navigate({ to: "/workout/log" });
    if (starting) return;
    setStarting(true);
    try {
      await starter.startPlan(plan, active);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full overflow-y-auto overscroll-none" data-scroll-root style={{ background: BG, fontFamily: FONT, color: INK }}>
      <div className="sticky top-0 z-10 bg-white/95 px-2 pt-safe-4 pb-1 backdrop-blur">
        <button type="button" onClick={back} aria-label="Back" className="flex h-11 w-11 items-center justify-center">
          <ChevronLeft size={24} />
        </button>
      </div>

      <section className="bg-white px-4 pb-5">
        <h1 className="text-[30px] font-black leading-tight tracking-tight">{day.title}</h1>
        <div className="mt-1 text-[14px] font-semibold" style={{ color: PURPLE }}>
          {plan.name} · Week {active.currentWeek} · Day {active.nextDay}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(plan.gear.length ? plan.gear : ["No equipment"]).map((g) => (
            <Chip key={g}>{g}</Chip>
          ))}
        </div>
      </section>

      <div className="space-y-3 px-4 pt-3 pb-44">
        <div className="flex gap-3 rounded-[20px] p-4" style={{ background: PURPLE_SOFT }}>
          <TrendingUp size={18} className="mt-0.5 shrink-0" style={{ color: PURPLE }} />
          <p className="text-[14px] leading-snug" style={{ color: "#4C1D95" }}>
            {plan.progressionRule}
          </p>
        </div>

        <section className="rounded-[20px] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold tracking-tight">Moves</h2>
            {day.note && (
              <span className="text-[13px] font-semibold" style={{ color: PURPLE }}>
                {day.note}
              </span>
            )}
          </div>
          <MoveList moves={movesForWeek(day.moves, !!weekNoteFor(plan, active.currentWeek)?.lighter)} />
        </section>

        <div className="flex gap-3 rounded-[20px] bg-white p-4 shadow-sm">
          <HeartPulse size={18} className="mt-0.5 shrink-0" style={{ color: MUTED }} />
          <p className="text-[13px] leading-snug" style={{ color: MUTED }}>
            {plan.safetyNote}
          </p>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-20 px-4 pt-3"
        style={{ background: `linear-gradient(to top, ${BG} 70%, transparent)`, paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <button
          type="button"
          onClick={() => void startLogging()}
          disabled={starting}
          className="h-14 w-full rounded-2xl text-[16px] font-semibold text-white disabled:opacity-70"
          style={{ background: PURPLE }}
        >
          {starting ? "Starting…" : "Start workout"}
        </button>
        <button type="button" onClick={doneCheckIn} className="mt-1 h-11 w-full text-[15px] font-semibold" style={{ color: PURPLE }}>
          Done, check in
        </button>
      </div>
    </div>
  );
}
