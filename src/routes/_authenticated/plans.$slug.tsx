import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, ListChecks, CalendarCheck, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TrialEndedPaywall } from "@/components/TrialEndedPaywall";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { hasActiveMembership } from "@/lib/membership";
import { startPlan } from "@/lib/plans.functions";
import {
  dayMinutes,
  hasWeeklyVariation,
  restDaysFor,
  scheduleForWeek,
  type PlanDay,
} from "@/lib/workout-plans";
import { BG, DayPreviewSheet, FONT, INK, MUTED, PURPLE, PURPLE_SOFT, gearText, useMyPlans, usePlans } from "@/components/plans/PlanBits";

export const Route = createFileRoute("/_authenticated/plans/$slug")({
  head: () => ({
    meta: [
      { title: "Workout plan · Pactara" },
      { name: "description", content: "A Pactara workout plan: schedule, moves and how it works." },
    ],
  }),
  component: PlanDetailPage,
});

function PlanDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const start = useServerFn(startPlan);
  const { data: plans, isLoading } = usePlans();
  const { data: mine } = useMyPlans();
  const plan = (plans ?? []).find((p) => p.slug === slug) ?? null;
  const active = mine?.active ?? null;
  const onThisPlan = !!active && active.slug === slug;

  const [week, setWeek] = useState<number | null>(null);
  const shownWeek = week ?? (onThisPlan ? active.currentWeek : 1);
  const [preview, setPreview] = useState<PlanDay | null>(null);
  const [checking, setChecking] = useState(false);
  const [paywall, setPaywall] = useState<{ firstName: string | null } | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [starting, setStarting] = useState(false);

  const back = () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/groups", search: { tab: "plans" } });
  };

  if (!plan) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: BG, fontFamily: FONT }}>
        {isLoading ? null : (
          <div className="px-8 text-center">
            <div className="text-[17px] font-bold">This plan isn't available</div>
            <button
              type="button"
              onClick={() => navigate({ to: "/groups", search: { tab: "plans" } })}
              className="mt-3 h-11 rounded-full px-5 text-[15px] font-semibold"
              style={{ background: PURPLE_SOFT, color: PURPLE }}
            >
              See all plans
            </button>
          </div>
        )}
      </div>
    );
  }

  const doStart = async () => {
    setStarting(true);
    try {
      await start({ data: { planId: plan.id } });
      await queryClient.invalidateQueries({ queryKey: ["my-plans"] });
      queryClient.invalidateQueries({ queryKey: ["crew-plans"] });
      navigate({ to: "/plans/$slug/day", params: { slug: plan.slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the plan. Try again.");
    } finally {
      setStarting(false);
    }
  };

  // Starting needs an active trial or subscription; browsing stays free.
  const onStartTap = async () => {
    if (onThisPlan) {
      navigate({ to: "/plans/$slug/day", params: { slug: plan.slug } });
      return;
    }
    setChecking(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const member = await hasActiveMembership(uid);
      if (!member) {
        const first = ((auth.user?.user_metadata?.name as string | undefined) ?? "").split(" ")[0] || null;
        setPaywall({ firstName: first });
        return;
      }
      if (active) setConfirmSwitch(true);
      else await doStart();
    } finally {
      setChecking(false);
    }
  };

  const schedule = scheduleForWeek(plan, shownWeek);
  const weekly = hasWeeklyVariation(plan);
  const busy = checking || starting;

  return (
    <div className="fixed inset-0 w-full overflow-y-auto overscroll-none" data-scroll-root style={{ background: BG, fontFamily: FONT, color: INK }}>
      <div className="sticky top-0 z-10 bg-white/95 px-2 pt-safe-4 pb-1 backdrop-blur">
        <button type="button" onClick={back} aria-label="Back" className="flex h-11 w-11 items-center justify-center">
          <ChevronLeft size={24} />
        </button>
      </div>

      <section className="bg-white px-4 pb-5">
        <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: PURPLE }}>
          Pactara plan · {plan.level}
        </div>
        <h1 className="mt-1 text-[30px] font-black leading-tight tracking-tight">{plan.name}</h1>
        <p className="mt-1.5 text-[15px] leading-snug" style={{ color: MUTED }}>
          {plan.summary}
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <Stat value={plan.weeks} label="weeks" />
          <Stat value={plan.daysPerWeek} label="days a week" />
          <Stat value={plan.minutes} label="min each" />
          <Stat value={restDaysFor(plan)} label="rest days" />
        </div>
      </section>

      <div className="space-y-3 px-4 pt-3 pb-32">
        <Card title="What you need">
          <p className="text-[15px]">{gearText(plan)}</p>
        </Card>

        <Card title="How it works">
          <ul className="space-y-3">
            <Point icon={<TrendingUp size={18} />}>{plan.progressionRule}</Point>
            <Point icon={<ListChecks size={18} />}>Every move comes with plain-English steps.</Point>
            <Point icon={<CalendarCheck size={18} />}>Fits your crew rule: rest days are applied for you.</Point>
          </ul>
        </Card>

        <Card title="The schedule">
          {weekly && (
            <div className="-mx-4 mb-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-2" role="group" aria-label="Week">
                {Array.from({ length: plan.weeks }, (_, i) => i + 1).map((w) => {
                  const on = w === shownWeek;
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setWeek(w)}
                      className="h-11 min-w-[44px] rounded-full px-3 text-[14px] font-semibold"
                      style={{ background: on ? PURPLE : BG, color: on ? "#FFFFFF" : INK }}
                    >
                      W{w}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {schedule.map((d) => {
              const isNext = onThisPlan && active.currentWeek === shownWeek && active.nextDay === d.dayNumber;
              return (
                <button
                  key={`${d.dayNumber}-${d.weekNumber ?? 0}`}
                  type="button"
                  onClick={() => setPreview(d)}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
                  style={{ background: BG, boxShadow: isNext ? `inset 0 0 0 2px ${PURPLE}` : undefined }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: PURPLE }}>
                      Day {d.dayNumber}
                      {isNext ? " · Up next" : ""}
                    </div>
                    <div className="truncate text-[15px] font-bold">{d.title}</div>
                    <div className="text-[13px]" style={{ color: MUTED }}>
                      {d.moves.length} {d.moves.length === 1 ? "move" : "moves"} · {dayMinutes(d, plan)} min
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-neutral-400" />
                </button>
              );
            })}
          </div>
          {plan.note && (
            <p className="mt-3 text-[13px]" style={{ color: MUTED }}>
              {plan.note}
            </p>
          )}
        </Card>

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
          onClick={onStartTap}
          disabled={busy}
          className="h-14 w-full rounded-2xl text-[16px] font-semibold text-white disabled:opacity-60"
          style={{ background: PURPLE }}
        >
          {busy ? "One moment…" : onThisPlan ? `Start Day ${active.nextDay}` : "Start this plan"}
        </button>
      </div>

      <DayPreviewSheet plan={plan} day={preview} week={shownWeek} onClose={() => setPreview(null)} />

      <AlertDialog open={confirmSwitch} onOpenChange={setConfirmSwitch}>
        <AlertDialogContent className="max-w-[340px] rounded-[20px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {plan.name}?</AlertDialogTitle>
            <AlertDialogDescription>Your progress on {active?.name} is kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              style={{ background: PURPLE }}
              onClick={() => {
                setConfirmSwitch(false);
                void doStart();
              }}
            >
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {paywall && (
        <TrialEndedPaywall
          firstName={paywall.firstName}
          mode="intro"
          onDismiss={() => {
            setPaywall(null);
            // Bought from the paywall? Carry straight on with starting the plan.
            void (async () => {
              const { data: auth } = await supabase.auth.getUser();
              if (auth.user && (await hasActiveMembership(auth.user.id))) {
                if (active) setConfirmSwitch(true);
                else await doStart();
              }
            })();
          }}
        />
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl px-2 py-3 text-center" style={{ background: BG }}>
      <div className="text-[20px] font-black leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] leading-tight" style={{ color: MUTED }}>
        {label}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-[17px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Point({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: PURPLE_SOFT, color: PURPLE }}>
        {icon}
      </span>
      <span className="text-[15px] leading-snug">{children}</span>
    </li>
  );
}
