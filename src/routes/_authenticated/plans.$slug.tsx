import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Armchair,
  BrickWall,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Dumbbell,
  Footprints,
  House,
  RectangleHorizontal,
  Share,
  type LucideIcon,
} from "lucide-react";
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
  crewProofLine,
  dayMinutes,
  planMuscleMap,
  restDaysFor,
  scheduleForWeek,
  weekNoteFor,
  type PlanDay,
} from "@/lib/workout-plans";
import { BG, DayPreviewSheet, FONT, P, PURPLE, PURPLE_SOFT, useCrewOnPlan, useMyPlans, usePlans } from "@/components/plans/PlanBits";
import { BodyMap } from "@/components/plans/BodyMap";

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
  const { data: crewOnPlan } = useCrewOnPlan(plan?.id ?? null);

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
  const shownNote = weekNoteFor(plan, shownWeek);
  const lighter = !!shownNote?.lighter;
  const busy = checking || starting;
  const currentWeek = onThisPlan ? active.currentWeek : null;
  const proof = crewProofLine(crewOnPlan ?? []);
  const gear = plan.gear.length ? plan.gear : ["No equipment"];

  const share = async () => {
    const url = `${window.location.origin}/plans/${plan.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: plan.name, text: `${plan.name}, a Pactara plan`, url });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't share this plan.");
    }
  };

  return (
    <div className="fixed inset-0 w-full overflow-y-auto overscroll-none" data-scroll-root style={{ background: P.pageBg, fontFamily: FONT, color: P.ink }}>
      <div className="relative h-[380px] overflow-hidden" style={{ background: "#1C1A22" }}>
        {plan.coverUrl && (
          <img src={plan.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,18,24,.5) 0%, rgba(20,18,24,0) 30%, rgba(30,12,64,.55) 62%, rgba(46,16,101,.96) 100%)",
          }}
        />
        <div className="absolute left-3 right-3 flex justify-between" style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}>
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white"
            style={{ background: "rgba(20,18,24,.6)" }}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={share}
            aria-label="Share plan"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white"
            style={{ background: "rgba(20,18,24,.6)" }}
          >
            <Share size={20} />
          </button>
        </div>
        <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-2 text-white">
          <span className="self-start rounded-full px-2.5 py-[5px] text-[12px] font-bold tracking-[0.4px]" style={{ background: "rgba(255,255,255,.18)" }}>
            PACTARA PLAN · {plan.level.toUpperCase()}
          </span>
          <h1 className="text-[36px] font-extrabold leading-none tracking-[-1px]">{plan.name}</h1>
          <span className="text-[15px] leading-[1.4]" style={{ color: "#EDE9FE" }}>
            {plan.summary}
          </span>
        </div>
        {plan.coverCredit && (
          <span className="absolute bottom-1 right-2.5 text-[11px] text-white/70">Photo: {plan.coverCredit}</span>
        )}
      </div>

      <div className="px-5 pb-5" style={{ background: "#2E1065" }}>
        <div className="grid grid-cols-4 gap-2">
          <Stat icon="🗓️" value={plan.weeks} label="weeks" />
          <Stat icon="💪" value={plan.daysPerWeek} label="days a week" />
          <Stat icon="⏱️" value={plan.minutes} label="min each" />
          <Stat icon="🌙" value={restDaysFor(plan)} label="rest days" />
        </div>
      </div>

      <div className="flex flex-col gap-[22px] px-4 pb-[130px] pt-[22px]">
        {proof && (
          <section
            className="flex items-center gap-3 rounded-[18px] bg-white px-[14px] py-3"
            style={{ boxShadow: "0 1px 2px rgba(20,18,24,.06)" }}
          >
            <span className="flex shrink-0">
              {(crewOnPlan ?? []).slice(0, 3).map((c, i) => (
                <span
                  key={c.userId}
                  className="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full border-2 border-white text-[13px] font-bold text-white"
                  style={{ background: c.avatarColor, marginLeft: i ? -10 : 0 }}
                >
                  {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : c.firstName.slice(0, 1)}
                </span>
              ))}
            </span>
            <span className="text-[14px] leading-snug">
              <strong className="font-extrabold">{proof.bold}</strong>
              {proof.rest}
            </span>
          </section>
        )}

        <Section title="What it works">
          <div className="flex items-center gap-4 rounded-[20px] bg-white p-4">
            <BodyMap muscles={planMuscleMap(plan)} width={150} height={143} />
            <div className="flex min-w-0 flex-col gap-[10px] text-[13px]">
              {plan.focusLine && <span className="text-[15px] font-extrabold leading-snug">{plan.focusLine}</span>}
              <Legend color="#7C3AED" label="Main focus" />
              <Legend color="#C4B5FD" label="Also worked" />
            </div>
          </div>
        </Section>

        <Section title={`Your ${plan.weeks} weeks`}>
          <div className="flex flex-col gap-[14px] rounded-[20px] bg-white px-[14px] pb-4 pt-[18px]">
            <div className="relative flex justify-between" role="group" aria-label="Weeks">
              <span className="absolute left-[17px] right-[17px] top-[15px] h-1 rounded-full" style={{ background: "#EDE6FE" }} aria-hidden />
              {currentWeek && plan.weeks > 1 && (
                <span
                  className="absolute left-[17px] top-[15px] h-1 rounded-full"
                  style={{ background: P.purple, width: `calc((100% - 34px) * ${(currentWeek - 1) / (plan.weeks - 1)})` }}
                  aria-hidden
                />
              )}
              {Array.from({ length: plan.weeks }, (_, i) => i + 1).map((w) => {
                const note = weekNoteFor(plan, w);
                const selected = w === shownWeek;
                const isCurrent = currentWeek ? w === currentWeek : selected;
                const done = !!currentWeek && w < currentWeek;
                const style = isCurrent
                  ? { background: P.purple, color: "#FFFFFF" }
                  : done
                    ? { background: "#EDE6FE", color: P.violetDeep, boxShadow: selected ? `inset 0 0 0 2px ${P.purple}` : undefined }
                    : { background: "#FFFFFF", color: P.violetText, boxShadow: `inset 0 0 0 2px ${selected ? P.purple : "#DDD6FE"}` };
                return (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`Week ${w}${note?.lighter ? ", lighter week" : ""}`}
                    onClick={() => setWeek(w)}
                    className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full text-[14px] font-extrabold before:absolute before:-inset-[5px] before:content-['']"
                    style={style}
                  >
                    {note?.lighter ? "🌙" : w}
                  </button>
                );
              })}
            </div>
            {shownNote && (
              <div className="flex gap-[10px] rounded-[14px] p-3" style={{ background: P.violetTint }}>
                <span className="text-[20px] leading-none">{shownNote.emoji}</span>
                <span className="leading-snug">
                  <span className="text-[14px] font-extrabold" style={{ color: P.violetDeep }}>
                    Week {shownNote.week}: {shownNote.title}
                  </span>
                  <br />
                  <span className="text-[13px]" style={{ color: P.violetText }}>
                    {shownNote.note}
                  </span>
                </span>
              </div>
            )}
          </div>
        </Section>

        <Section title="What you need">
          <div className="grid grid-cols-2 gap-[10px]">
            {gear.map((g) => {
              const Icon = gearIcon(g);
              return (
                <div key={g} className="flex items-center gap-[10px] rounded-[16px] bg-white p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "#EDE7FB", color: P.violetText }}>
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className="min-w-0 text-[14px] font-bold leading-snug">{g}</span>
                </div>
              );
            })}
          </div>
        </Section>

        <section className="flex flex-col gap-[10px]">
          <div className="mx-1 flex items-baseline justify-between">
            <h2 className="text-[18px] font-extrabold">Week {shownWeek} workouts</h2>
            <span className="text-[13px]" style={{ color: P.stone }}>
              Tap to preview
            </span>
          </div>
          {schedule.map((d) => {
            const isNext = onThisPlan && active.currentWeek === shownWeek && active.nextDay === d.dayNumber;
            return (
              <button
                key={`${d.dayNumber}-${d.weekNumber ?? 0}`}
                type="button"
                onClick={() => setPreview(d)}
                className="flex w-full items-center gap-[14px] rounded-[18px] bg-white py-[10px] pl-[10px] pr-[14px] text-left"
                style={{ boxShadow: isNext ? `0 1px 2px rgba(20,18,24,.06), inset 0 0 0 2px ${P.purple}` : "0 1px 2px rgba(20,18,24,.06)" }}
              >
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px]" style={{ background: P.tile }}>
                  <BodyMap muscles={d.muscles} width={58} height={55} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-[12px] font-extrabold tracking-[0.5px]" style={{ color: P.violet }}>
                    DAY {d.dayNumber}
                    {isNext ? " · UP NEXT" : ""}
                  </span>
                  <span className="text-[16px] font-extrabold leading-tight">{d.title}</span>
                  <span className="text-[13px]" style={{ color: P.stone }}>
                    {d.moves.length} {d.moves.length === 1 ? "move" : "moves"} · {dayMinutes(d, plan)} min
                  </span>
                </span>
                <ChevronRight size={20} className="shrink-0" style={{ color: P.chevron }} aria-hidden />
              </button>
            );
          })}
          {plan.note && (
            <p className="mx-1 text-[13px]" style={{ color: P.stone }}>
              {plan.note}
            </p>
          )}
        </section>

        <div className="flex gap-[10px] rounded-[14px] px-[14px] py-3 text-[13px] leading-snug" style={{ background: "#F4F2EF", color: P.stoneDark }}>
          <span aria-hidden>⚠️</span>
          <span>{plan.safetyNote}</span>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-20 px-4 pt-[14px]"
        style={{
          background: "linear-gradient(180deg, rgba(245,242,238,0) 0%, #F5F2EE 30%)",
          paddingBottom: "max(30px, env(safe-area-inset-bottom))",
        }}
      >
        <button
          type="button"
          onClick={onStartTap}
          disabled={busy}
          className="h-14 w-full rounded-[28px] text-[16px] font-bold text-white disabled:opacity-60"
          style={{ background: P.violet, boxShadow: "0 8px 20px rgba(109,40,217,.3)" }}
        >
          {busy ? "One moment…" : onThisPlan ? `Start Day ${active.nextDay}` : "Start this plan"}
        </button>
      </div>

      <DayPreviewSheet plan={plan} day={preview} week={shownWeek} lighter={lighter} onClose={() => setPreview(null)} />

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

function Stat({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] p-[10px] text-white" style={{ background: "rgba(255,255,255,.1)" }}>
      <span className="text-[16px] leading-none" aria-hidden>
        {icon}
      </span>
      <span className="text-[18px] font-extrabold leading-none">{value}</span>
      <span className="text-[11px] leading-tight" style={{ color: "#DDD6FE" }}>
        {label}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[10px]">
      <h2 className="mx-1 text-[18px] font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2" style={{ color: P.stoneDark }}>
      <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

function gearIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/dumbbell|water bottle/.test(n)) return Dumbbell;
  if (/bench|step/.test(n)) return RectangleHorizontal;
  if (/band/.test(n)) return CircleDot;
  if (/chair/.test(n)) return Armchair;
  if (/wall/.test(n)) return BrickWall;
  if (/shoe/.test(n)) return Footprints;
  return House;
}
