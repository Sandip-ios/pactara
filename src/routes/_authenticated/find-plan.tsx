import { createFileRoute, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { listMyGroups } from "@/lib/groups.functions";
import { weeklyTarget } from "@/lib/streak-rules";
import { coverThumb, toFilterParam } from "@/lib/plan-filters";
import {
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  QUIZ_DAY_OPTIONS,
  QUIZ_GOALS,
  QUIZ_STEPS,
  matchPlans,
  parseEquipment,
  parseExperience,
  parseQuizDays,
  parseQuizGoal,
  presetDays,
  browseFilters,
  type QuizAnswers,
} from "@/lib/plan-quiz";
import type { EquipmentKey, Plan, PlanGoal } from "@/lib/workout-plans";
import { GOAL_TILE, P, usePlans } from "@/components/plans/PlanBits";
import { MemberAvatar } from "@/components/groups/AccountabilityBits";

type QuizSearch = { step?: number; goal?: string; exp?: string; gear?: string; days?: number };

export const Route = createFileRoute("/_authenticated/find-plan")({
  // Answers live in the URL so going back from a plan page lands on the same results.
  validateSearch: (s: Record<string, unknown>): QuizSearch => {
    const step = Number(s.step);
    return {
      step: Number.isInteger(step) && step >= 1 && step <= QUIZ_STEPS + 1 ? step : undefined,
      goal: parseQuizGoal(s.goal),
      exp: parseExperience(s.exp),
      gear: parseEquipment(s.gear).join(",") || undefined,
      days: parseQuizDays(s.days),
    };
  },
  head: () => ({
    meta: [
      { title: "Find your plan · Pactara" },
      { name: "description", content: "Answer 4 quick questions and Pactara picks the workout plan that fits your goal, gear and week." },
      { property: "og:title", content: "Find your plan · Pactara" },
      { property: "og:description", content: "Answer 4 quick questions and Pactara picks the workout plan that fits your goal, gear and week." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FindPlanPage,
});

const PURPLE = "#7C3AED";
const ORANGE = "#C2410C";
const TOP = "max(16px, calc(env(safe-area-inset-top) + 8px))";
/** The quiz's own button bar sits just above the app's bottom bar. */
const ABOVE_TABS = "calc(var(--toast-bottom, 93px) - 12px)";

function FindPlanPage() {
  const scrollRef = useOpenAtTop();
  useStatusBarScrollToTop();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const search = Route.useSearch();
  const { data: plans } = usePlans();
  const { data: groupsData } = useQuery({ queryKey: ["my-groups"], queryFn: () => listMyGroups(), staleTime: 60_000 });

  const goal = parseQuizGoal(search.goal);
  const experience = parseExperience(search.exp);
  const equipment = parseEquipment(search.gear);
  const pickedDays = parseQuizDays(search.days);

  // The crew with the highest weekly rule sets Q4's starting pick and the crew notes.
  const crew = useMemo(() => {
    const groups = groupsData?.groups ?? [];
    let best: { name: string; days: number; mates: (typeof groups)[number]["members"] } | null = null;
    for (const g of groups) {
      const days = weeklyTarget({ frequency: g.frequency, days_per_week: g.daysPerWeek });
      if (!best || days > best.days) best = { name: g.name, days, mates: g.members.filter((m) => !m.isYou) };
    }
    return best;
  }, [groupsData]);
  const days = pickedDays ?? presetDays(crew ? [crew.days] : []) ?? undefined;

  // A step whose earlier answers are missing falls back to the first unanswered question.
  const wanted = search.step ?? 1;
  const firstMissing = !goal ? 1 : !experience ? 2 : equipment.length === 0 ? 3 : !pickedDays ? 4 : 5;
  const step = Math.min(wanted, firstMissing);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step, scrollRef]);

  const go = (next: QuizSearch) =>
    navigate({ to: "/find-plan", search: { ...search, ...next }, replace: true, resetScroll: false });
  const close = () => {
    if (canGoBack) router.history.back();
    else void navigate({ to: "/groups" });
  };
  const back = () => (step <= 1 ? close() : go({ step: step - 1 }));

  const answers: QuizAnswers | null =
    goal && experience && equipment.length && pickedDays ? { goal, experience, equipment, days: pickedDays } : null;

  return (
    <div
      ref={scrollRef}
      data-scroll-root
      className="fixed inset-0 w-full overflow-y-auto overscroll-none"
      style={{ background: P.pageBg, color: P.ink, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="flex min-h-full flex-col px-4 pb-[230px]" style={{ paddingTop: TOP }}>
        {step <= QUIZ_STEPS ? (
          <>
            <QuizTopBar step={step} onBack={back} onClose={close} />
            {step === 1 && <GoalStep value={goal} onPick={(g) => go({ goal: g, step: 2 })} />}
            {step === 2 && <ExperienceStep value={experience} onPick={(e) => go({ exp: e, step: 3 })} />}
            {step === 3 && (
              <EquipmentStep
                initial={equipment}
                onContinue={(picked) => go({ gear: picked.join(","), step: 4 })}
              />
            )}
            {step === 4 && (
              <DaysStep
                initial={days}
                crew={groupsData ? crew : undefined}
                onContinue={(d) => go({ days: d, step: 5 })}
              />
            )}
          </>
        ) : answers && plans ? (
          <Results
            plans={plans}
            answers={answers}
            crewDays={crew?.days ?? null}
            onClose={close}
            onOpen={(slug) => navigate({ to: "/plans/$slug", params: { slug } })}
            onBrowse={() => {
              const f = browseFilters(plans, answers);
              void navigate({
                to: "/groups",
                search: {
                  goal: toFilterParam(f.goal),
                  equipment: toFilterParam(f.equipment),
                  level: toFilterParam(f.level),
                  days: toFilterParam(f.days),
                  list: 1,
                },
              });
            }}
          />
        ) : (
          <div className="mt-24 h-[300px] animate-pulse rounded-[22px] bg-white/70" />
        )}
      </div>
    </div>
  );
}

function QuizTopBar({ step, onBack, onClose }: { step: number; onBack: () => void; onClose: () => void }) {
  return (
    <div className="-mx-2 mb-5 flex items-center gap-2">
      <button type="button" onClick={onBack} aria-label={step <= 1 ? "Close" : "Back"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
        <ChevronLeft size={26} />
      </button>
      <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={QUIZ_STEPS} aria-valuenow={step} aria-label={`Question ${step} of ${QUIZ_STEPS}`}>
        {Array.from({ length: QUIZ_STEPS }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < step ? PURPLE : P.line }} />
        ))}
      </div>
      <button type="button" onClick={onClose} aria-label="Close quiz" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
        <X size={22} />
      </button>
    </div>
  );
}

function StepTitle({ title, helper }: { title: string; helper: string }) {
  return (
    <div className="mb-5 flex flex-col gap-1.5 px-1">
      <h1 className="text-[28px] font-black leading-[1.1] tracking-[-0.6px]">{title}</h1>
      <p className="min-h-[21px] text-[15px]" style={{ color: P.stone }}>
        {helper}
      </p>
    </div>
  );
}

function CheckBadge() {
  return (
    <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: PURPLE }} aria-hidden>
      <Check size={15} strokeWidth={3} />
    </span>
  );
}

function GoalStep({ value, onPick }: { value?: PlanGoal; onPick: (g: PlanGoal) => void }) {
  const [picked, setPicked] = useState<PlanGoal | undefined>(value);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);
  return (
    <>
      <StepTitle title="What do you want most?" helper="Tap one to keep going." />
      <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Goal">
        {QUIZ_GOALS.map((g) => {
          const on = picked === g.goal;
          const tile = GOAL_TILE[g.goal];
          return (
            <button
              key={g.goal}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setPicked(g.goal);
                if (timer.current) window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => onPick(g.goal), 250);
              }}
              className="relative flex min-h-[104px] flex-col items-start gap-2 rounded-[18px] bg-white p-3 text-left"
              style={{ boxShadow: on ? `inset 0 0 0 2.5px ${PURPLE}` : "inset 0 0 0 1px #EDEAE6" }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] text-[22px]" style={{ background: tile.tint }} aria-hidden>
                {g.emoji}
              </span>
              <span className="flex flex-col">
                <span className="text-[16px] font-extrabold leading-tight">{g.label}</span>
                <span className="text-[13px]" style={{ color: P.stone }}>
                  {g.hint}
                </span>
              </span>
              {on && <CheckBadge />}
            </button>
          );
        })}
        <div
          className="flex min-h-[104px] items-center justify-center rounded-[18px] p-3 text-center text-[14px] font-semibold"
          style={{ border: `2px dashed ${P.line}`, color: P.stone }}
        >
          You can switch plans anytime
        </div>
      </div>
    </>
  );
}

function ExperienceStep({ value, onPick }: { value?: QuizAnswers["experience"]; onPick: (e: QuizAnswers["experience"]) => void }) {
  const [picked, setPicked] = useState(value);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);
  return (
    <>
      <StepTitle title="How much have you worked out before?" helper="Be honest. We match the plan to where you are now." />
      <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Experience">
        {EXPERIENCE_OPTIONS.map((o) => {
          const on = picked === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setPicked(o.value);
                if (timer.current) window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => onPick(o.value), 250);
              }}
              className="relative flex min-h-[76px] items-center gap-3 rounded-[18px] bg-white px-4 py-3 text-left"
              style={{ boxShadow: on ? `inset 0 0 0 2.5px ${PURPLE}` : "inset 0 0 0 1px #EDEAE6" }}
            >
              <span className="text-[26px]" aria-hidden>
                {o.emoji}
              </span>
              <span className="flex flex-col pr-8">
                <span className="text-[16px] font-extrabold">{o.label}</span>
                <span className="text-[14px]" style={{ color: P.stone }}>
                  {o.hint}
                </span>
              </span>
              {on && <CheckBadge />}
            </button>
          );
        })}
      </div>
    </>
  );
}

function BottomBar({ children, tight = false }: { children: React.ReactNode; tight?: boolean }) {
  return (
    <div className={`fixed inset-x-0 z-[55] px-4 pb-3 ${tight ? "pt-3" : "pt-6"}`} style={{ bottom: ABOVE_TABS, background: `linear-gradient(to bottom, rgba(245,242,238,0), ${P.pageBg} 40%)` }}>
      {children}
    </div>
  );
}

function PrimaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-[54px] w-full rounded-[16px] text-[16px] font-extrabold text-white disabled:cursor-not-allowed"
      style={{ background: disabled ? "#D6D3D1" : PURPLE }}
    >
      {children}
    </button>
  );
}

function EquipmentStep({ initial, onContinue }: { initial: EquipmentKey[]; onContinue: (picked: EquipmentKey[]) => void }) {
  const [picked, setPicked] = useState<EquipmentKey[]>(initial);
  const toggle = (k: EquipmentKey) =>
    setPicked((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : EQUIPMENT_OPTIONS.map((o) => o.value).filter((v) => v === k || cur.includes(v))));
  return (
    <>
      <StepTitle title="What can you use?" helper="Pick all that apply. We only suggest plans you can do." />
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Equipment">
        {EQUIPMENT_OPTIONS.map((o) => {
          const on = picked.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(o.value)}
              className="relative flex min-h-[104px] flex-col items-start gap-2 rounded-[18px] bg-white p-3 text-left"
              style={{ boxShadow: on ? `inset 0 0 0 2.5px ${PURPLE}` : "inset 0 0 0 1px #EDEAE6" }}
            >
              <span className="text-[26px]" aria-hidden>
                {o.emoji}
              </span>
              <span className="flex flex-col">
                <span className="text-[16px] font-extrabold leading-tight">{o.label}</span>
                <span className="text-[13px]" style={{ color: P.stone }}>
                  {o.hint}
                </span>
              </span>
              <span
                className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full"
                style={on ? { background: PURPLE, color: "#FFFFFF" } : { border: `2px solid ${P.line}` }}
                aria-hidden
              >
                {on && <Check size={15} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <BottomBar>
        <PrimaryButton disabled={picked.length === 0} onClick={() => onContinue(picked)}>
          Continue
        </PrimaryButton>
      </BottomBar>
    </>
  );
}

type Crew = { name: string; days: number; mates: { id: string; name: string; avatarUrl: string | null; avatarColor: string }[] };

/** `crew`: undefined while crews are loading, null when the member has none. */
function DaysStep({ initial, crew, onContinue }: { initial?: number; crew: Crew | null | undefined; onContinue: (d: number) => void }) {
  const [picked, setPicked] = useState<number | undefined>(initial);
  // The crew's rule arrives after the first paint: preselect it unless the member already chose.
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current && initial !== undefined) setPicked(initial);
  }, [initial]);
  const helper = crew === undefined ? "" : crew ? "We picked your crew's rule. Change it if you like." : "Pick what fits your week.";
  return (
    <>
      <StepTitle title="How many days a week?" helper={helper} />
      <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Days a week">
        {QUIZ_DAY_OPTIONS.map((d) => {
          const on = picked === d;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${d} days`}
              onClick={() => {
                touched.current = true;
                setPicked(d);
              }}
              className="flex h-[112px] flex-col items-center justify-center rounded-[18px]"
              style={on ? { background: PURPLE, color: "#FFFFFF" } : { background: "#FFFFFF", boxShadow: "inset 0 0 0 1px #EDEAE6" }}
            >
              <span className="text-[38px] font-black leading-none">{d}</span>
              <span className="mt-1 text-[14px] font-semibold" style={{ color: on ? "#EDE9FE" : P.stone }}>
                days
              </span>
            </button>
          );
        })}
      </div>
      {crew && (
        <div className="mt-4 flex items-center gap-3 rounded-[16px] px-4 py-3" style={{ background: "#EDE7FB" }}>
          {crew.mates.length > 0 && (
            <span className="flex shrink-0 -space-x-2">
              {crew.mates.slice(0, 3).map((m) => (
                <span key={m.id} className="rounded-full ring-2 ring-[#EDE7FB]">
                  <MemberAvatar member={m} size={30} />
                </span>
              ))}
            </span>
          )}
          <p className="text-[14px] leading-snug" style={{ color: "#4C1D95" }}>
            <b>
              {crew.name} checks in {crew.days} {crew.days === 1 ? "day" : "days"} a week.
            </b>{" "}
            Pick fewer and the other days can be a walk, a run or any workout.
          </p>
        </div>
      )}
      <BottomBar>
        <PrimaryButton disabled={picked === undefined} onClick={() => picked !== undefined && onContinue(picked)}>
          Show my plans
        </PrimaryButton>
      </BottomBar>
    </>
  );
}

function Cover({ plan, px, className }: { plan: Plan; px: number; className: string }) {
  const [failed, setFailed] = useState(false);
  const src = px > 300 ? plan.coverUrl : coverThumb(plan.coverUrl, px);
  return (
    <span className={`block overflow-hidden ${className}`} style={{ background: GOAL_TILE[plan.goal]?.tint ?? P.tile }}>
      {src && !failed && <img src={src} alt="" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" data-plan-cover={plan.slug} />}
    </span>
  );
}

function Results({
  plans,
  answers,
  crewDays,
  onClose,
  onOpen,
  onBrowse,
}: {
  plans: Plan[];
  answers: QuizAnswers;
  crewDays: number | null;
  onClose: () => void;
  onOpen: (slug: string) => void;
  onBrowse: () => void;
}) {
  const match = useMemo(() => matchPlans(plans, answers, crewDays), [plans, answers, crewDays]);
  if (!match) return null;
  const { best, also, crewLine } = match;
  const bp = best.plan;
  return (
    <>
      <div className="-mr-2 mb-3 flex items-center justify-between">
        <span className="px-1 text-[13px] font-extrabold tracking-[0.8px]" style={{ color: PURPLE }}>
          YOUR BEST MATCH
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full">
          <X size={22} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onOpen(bp.slug)}
        className="relative block h-[300px] w-full overflow-hidden rounded-[22px] text-left"
        aria-label={`Best match: ${bp.name}`}
      >
        <Cover plan={bp} px={1200} className="absolute inset-0 h-full w-full" />
        <span className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,10,10,0) 30%, rgba(10,10,10,.82) 100%)" }} />
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 text-white">
          <span className="text-[26px] font-bold leading-tight tracking-[-0.4px]">{bp.name}</span>
          <span className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,.88)" }}>
            {bp.weeks} weeks · {bp.daysPerWeek} days a week · {bp.minutes} min
          </span>
          {crewLine && (
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,.8)" }}>
              {crewLine}
            </span>
          )}
          {best.why.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1.5">
              {best.why.map((w) => (
                <span key={w} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "rgba(255,255,255,.2)" }}>
                  <Check size={13} strokeWidth={3} aria-hidden />
                  {w}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>

      {also.length > 0 && (
        <section className="mt-6 flex flex-col gap-2.5">
          <h2 className="px-1 text-[13px] font-extrabold tracking-[0.8px]" style={{ color: P.stone }}>
            ALSO A GOOD FIT
          </h2>
          {also.map((r) => (
            <button
              key={r.plan.slug}
              type="button"
              onClick={() => onOpen(r.plan.slug)}
              className="flex w-full items-center gap-3 rounded-[16px] bg-white p-2.5 text-left"
            >
              <Cover plan={r.plan} px={192} className="h-16 w-16 shrink-0 rounded-[12px]" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[16px] font-bold leading-tight">{r.plan.name}</span>
                {r.why.length > 0 && (
                  <span className="text-[13px]" style={{ color: P.stone }}>
                    {r.why.join(" · ")}
                  </span>
                )}
                {r.difference && (
                  <span className="text-[13px] font-semibold" style={{ color: ORANGE }}>
                    {r.difference}
                  </span>
                )}
              </span>
              <ChevronRight size={20} className="shrink-0" style={{ color: P.chevron }} aria-hidden />
            </button>
          ))}
        </section>
      )}

      <BottomBar tight>
        <PrimaryButton onClick={() => onOpen(bp.slug)}>See this plan</PrimaryButton>
        <button type="button" onClick={onBrowse} className="mt-1 flex h-11 w-full items-center justify-center text-[15px] font-bold" style={{ color: P.violet }}>
          Browse all plans with my answers
        </button>
      </BottomBar>
    </>
  );
}
