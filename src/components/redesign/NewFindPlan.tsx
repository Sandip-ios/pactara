import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { listMyGroups } from "@/lib/groups.functions";
import { weeklyTarget } from "@/lib/streak-rules";
import { coverThumb, toFilterParam } from "@/lib/plan-filters";
import { EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS, QUIZ_DAY_OPTIONS, QUIZ_GOALS, QUIZ_STEPS, matchPlans, parseEquipment, parseExperience, parseQuizDays, parseQuizGoal, type QuizAnswers } from "@/lib/plan-quiz";
import { browseWithDropped, daysStepState } from "@/lib/new-quiz";
import type { EquipmentKey, Plan, PlanGoal } from "@/lib/workout-plans";
import { GOAL_TILE, usePlans } from "@/components/plans/PlanBits";
import { MemberAvatar } from "@/components/groups/AccountabilityBits";
import { useSaveQuizResult } from "@/components/plans/QuizMatchCard";

const BG = "#F5F2EC";
const INK = "#1C1917";
const GRAY = "#57534E";
const PURPLE = "#7C3AED";
const ORANGE = "#C2410C";
const FONT = "Inter, system-ui, sans-serif";
const ABOVE_HOME = "max(16px, calc(env(safe-area-inset-bottom) + 12px))";
const CARD_RING = "inset 0 0 0 1px #EDEAE6";
const ON_RING = `inset 0 0 0 2px ${PURPLE}`;

export type FindPlanSearch = { step?: number; goal?: string; exp?: string; gear?: string; days?: number };

/** New-version quiz. Same URL steps, answers and matching as classic. */
export function NewFindPlan({ search }: { search: FindPlanSearch }) {
  const scrollRef = useOpenAtTop();
  useStatusBarScrollToTop();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { data: plans } = usePlans();
  const { data: groupsData } = useQuery({ queryKey: ["my-groups"], queryFn: () => listMyGroups(), staleTime: 60_000 });
  const [loading, setLoading] = useState(false);

  const goal = parseQuizGoal(search.goal);
  const experience = parseExperience(search.exp);
  const equipment = parseEquipment(search.gear);
  const pickedDays = parseQuizDays(search.days);

  const crew = useMemo(() => {
    const groups = groupsData?.groups ?? [];
    let best: { name: string; days: number; mates: (typeof groups)[number]["members"] } | null = null;
    for (const g of groups) {
      const days = weeklyTarget({ frequency: g.frequency, days_per_week: g.daysPerWeek });
      if (!best || days > best.days) best = { name: g.name, days, mates: g.members.filter((m) => !m.isYou) };
    }
    return best;
  }, [groupsData]);

  const wanted = search.step ?? 1;
  const firstMissing = !goal ? 1 : !experience ? 2 : equipment.length === 0 ? 3 : !pickedDays ? 4 : 5;
  const step = Math.min(wanted, firstMissing);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step, loading, scrollRef]);

  const go = (next: FindPlanSearch) => navigate({ to: "/find-plan", search: { ...search, ...next }, replace: true, resetScroll: false });
  const close = () => {
    if (canGoBack) router.history.back();
    else void navigate({ to: "/groups", search: { tab: "plans" } });
  };
  const back = () => (step <= 1 ? close() : go({ step: step - 1 }));

  const answers: QuizAnswers | null = goal && experience && equipment.length && pickedDays ? { goal, experience, equipment, days: pickedDays } : null;
  const saveResult = useSaveQuizResult();
  const key = answers ? `${answers.goal}|${answers.experience}|${answers.equipment.join(",")}|${answers.days}` : null;
  useEffect(() => {
    if (step > QUIZ_STEPS && answers) void saveResult(answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, key]);

  return (
    <div ref={scrollRef} data-scroll-root className="fixed inset-0 w-full overflow-y-auto overscroll-none" style={{ background: BG, color: INK, fontFamily: FONT }}>
      <div className="flex min-h-full flex-col px-4 pt-new-top" style={{ paddingBottom: "calc(170px + env(safe-area-inset-bottom))" }}>
        {loading ? (
          <Loading />
        ) : step <= QUIZ_STEPS ? (
          <>
            <TopBar step={step} onBack={back} onClose={close} />
            {step === 1 && <GoalStep value={goal} onPick={(g) => go({ goal: g, step: 2 })} />}
            {step === 2 && <ExperienceStep value={experience} onPick={(e) => go({ exp: e, step: 3 })} />}
            {step === 3 && <GearStep initial={equipment} onContinue={(p) => go({ gear: p.join(","), step: 4 })} />}
            {step === 4 && groupsData && (
              <DaysStep
                initial={pickedDays}
                crew={crew}
                onContinue={(d) => {
                  setLoading(true);
                  window.setTimeout(() => {
                    setLoading(false);
                    void go({ days: d, step: 5 });
                  }, 1000);
                }}
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
              const { filters: f, dropped } = browseWithDropped(plans, answers);
              void navigate({
                to: "/groups",
                search: {
                  tab: "plans",
                  goal: toFilterParam(f.goal),
                  equipment: toFilterParam(f.equipment),
                  level: toFilterParam(f.level),
                  days: toFilterParam(f.days),
                  quiz: 1,
                  dropped: dropped.length ? dropped.join(",") : undefined,
                },
              });
            }}
          />
        ) : (
          <Loading />
        )}
      </div>
    </div>
  );
}

function TopBar({ step, onBack, onClose }: { step: number; onBack: () => void; onClose: () => void }) {
  return (
    <div className="-mx-2 mb-5 flex items-center gap-2">
      <button type="button" onClick={onBack} aria-label={step <= 1 ? "Close" : "Back"} className="flex h-11 w-11 shrink-0 items-center justify-center">
        <ChevronLeft size={26} />
      </button>
      <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={QUIZ_STEPS} aria-valuenow={step} aria-label={`Question ${step} of ${QUIZ_STEPS}`}>
        {Array.from({ length: QUIZ_STEPS }, (_, i) => (
          <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i < step ? PURPLE : "#E7E2DA" }} />
        ))}
      </div>
      <button type="button" onClick={onClose} aria-label="Close quiz" className="flex h-11 w-11 shrink-0 items-center justify-center">
        <X size={22} />
      </button>
    </div>
  );
}

function Title({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5 flex flex-col gap-1.5">
      <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.4px]">{title}</h1>
      <p className="text-[14px]" style={{ color: GRAY }}>{sub}</p>
    </div>
  );
}

function Check22({ on }: { on: boolean }) {
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={on ? { background: PURPLE, color: "#FFFFFF" } : { border: "2px solid #D6D3D1" }} aria-hidden>
      {on && <Check size={14} strokeWidth={3} />}
    </span>
  );
}

function useTapThenGo<T>(value: T | undefined, onPick: (v: T) => void) {
  const [picked, setPicked] = useState<T | undefined>(value);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);
  return {
    picked,
    tap: (v: T) => {
      setPicked(v);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => onPick(v), 220);
    },
  };
}

function GoalStep({ value, onPick }: { value?: PlanGoal; onPick: (g: PlanGoal) => void }) {
  const { picked, tap } = useTapThenGo(value, onPick);
  return (
    <>
      <Title title="What do you want most?" sub="Tap one to keep going." />
      <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Goal">
        {QUIZ_GOALS.map((g) => {
          const on = picked === g.goal;
          return (
            <button key={g.goal} type="button" role="radio" aria-checked={on} onClick={() => tap(g.goal)} className="relative flex min-h-[84px] flex-col items-start gap-2 rounded-[16px] bg-white p-3 text-left" style={{ boxShadow: on ? ON_RING : CARD_RING }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[19px]" style={{ background: GOAL_TILE[g.goal]?.tint ?? "#F0EDE8" }} aria-hidden>{g.emoji}</span>
              <span className="flex flex-col">
                <span className="text-[15px] font-extrabold leading-tight">{g.label}</span>
                <span className="text-[12px]" style={{ color: GRAY }}>{g.hint}</span>
              </span>
              {on && <span className="absolute right-2.5 top-2.5"><Check22 on /></span>}
            </button>
          );
        })}
        <div className="flex min-h-[84px] items-center justify-center rounded-[16px] p-3 text-center text-[13px]" style={{ border: "1.5px dashed #D6D3D1", color: GRAY }}>
          You can switch plans anytime
        </div>
      </div>
    </>
  );
}

function ExperienceStep({ value, onPick }: { value?: QuizAnswers["experience"]; onPick: (e: QuizAnswers["experience"]) => void }) {
  const { picked, tap } = useTapThenGo(value, onPick);
  return (
    <>
      <Title title="How much have you worked out before?" sub="Be honest. We match the plan to where you are now." />
      <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Experience">
        {EXPERIENCE_OPTIONS.map((o) => {
          const on = picked === o.value;
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => tap(o.value)} className="flex h-16 items-center gap-3 rounded-[16px] bg-white px-4 text-left" style={{ boxShadow: on ? ON_RING : CARD_RING }}>
              <span className="text-[24px]" aria-hidden>{o.emoji}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-extrabold">{o.label}</span>
                <span className="text-[13px]" style={{ color: GRAY }}>{o.hint}</span>
              </span>
              {on && <Check22 on />}
            </button>
          );
        })}
      </div>
    </>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[55] px-4 pt-6" style={{ paddingBottom: ABOVE_HOME, background: `linear-gradient(to bottom, rgba(245,242,236,0), ${BG} 40%)`, fontFamily: FONT }}>
      {children}
    </div>
  );
}

function Primary({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="h-[52px] w-full rounded-full text-[17px] font-bold text-white disabled:cursor-not-allowed" style={{ background: disabled ? "#D6D3D1" : PURPLE }}>
      {children}
    </button>
  );
}

function GearStep({ initial, onContinue }: { initial: EquipmentKey[]; onContinue: (p: EquipmentKey[]) => void }) {
  const [picked, setPicked] = useState<EquipmentKey[]>(initial);
  const toggle = (k: EquipmentKey) => setPicked((cur) => EQUIPMENT_OPTIONS.map((o) => o.value).filter((v) => (v === k ? !cur.includes(k) : cur.includes(v))));
  return (
    <>
      <Title title="What can you use?" sub="Pick all that apply. We only suggest plans you can do." />
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Equipment">
        {EQUIPMENT_OPTIONS.map((o) => {
          const on = picked.includes(o.value);
          return (
            <button key={o.value} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(o.value)} className="relative flex min-h-[84px] flex-col items-start gap-2 rounded-[16px] bg-white p-3 text-left" style={{ boxShadow: on ? ON_RING : CARD_RING }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[19px]" style={{ background: "#F0EDE8" }} aria-hidden>{o.emoji}</span>
              <span className="flex flex-col">
                <span className="text-[15px] font-extrabold leading-tight">{o.label}</span>
                <span className="text-[12px]" style={{ color: GRAY }}>{o.hint}</span>
              </span>
              <span className="absolute right-2.5 top-2.5"><Check22 on={on} /></span>
            </button>
          );
        })}
      </div>
      <BottomBar>
        <Primary disabled={picked.length === 0} onClick={() => onContinue(picked)}>Continue</Primary>
      </BottomBar>
    </>
  );
}

type Crew = { name: string; days: number; mates: { id: string; name: string; avatarUrl: string | null; avatarColor: string }[] };

function DaysStep({ initial, crew, onContinue }: { initial?: number; crew: Crew | null; onContinue: (d: number) => void }) {
  const [picked, setPicked] = useState<number | undefined>(initial);
  const state = daysStepState(crew?.days ?? null, picked);
  return (
    <>
      <Title title="How many days a week?" sub={state.subtitle} />
      <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Days a week">
        {QUIZ_DAY_OPTIONS.map((d) => {
          const on = state.value === d;
          return (
            <button key={d} type="button" role="radio" aria-checked={on} aria-label={`${d} days`} onClick={() => setPicked(d)} className="flex h-[100px] flex-col items-center justify-center rounded-[16px]" style={on ? { background: PURPLE, color: "#FFFFFF" } : { background: "#FFFFFF", boxShadow: CARD_RING }}>
              <span className="text-[34px] font-extrabold leading-none">{d}</span>
              <span className="mt-1 text-[13px]" style={{ color: on ? "#EDE9FE" : GRAY }}>days</span>
            </button>
          );
        })}
      </div>
      {crew && (
        <div className="mt-4 flex items-center gap-3 rounded-[16px] px-4 py-3" style={{ background: "#EDE9FE" }}>
          {crew.mates.length > 0 && (
            <span className="flex shrink-0 -space-x-2">
              {crew.mates.slice(0, 3).map((m) => (
                <span key={m.id} className="rounded-full ring-2 ring-[#EDE9FE]"><MemberAvatar member={m} size={28} /></span>
              ))}
            </span>
          )}
          <p className="text-[14px] leading-snug" style={{ color: "#5B21B6" }}>
            <b>{crew.name} checks in {crew.days} {crew.days === 1 ? "day" : "days"} a week.</b> Pick fewer and the other days can be a walk, a run or any workout.
          </p>
        </div>
      )}
      <BottomBar>
        <Primary disabled={!state.canContinue} onClick={() => state.value !== undefined && onContinue(state.value)}>Show my plans</Primary>
      </BottomBar>
    </>
  );
}

function Loading() {
  return (
    <div className="mt-6 flex flex-col gap-3" aria-busy="true">
      <div className="h-[230px] animate-pulse rounded-[18px]" style={{ background: "#ECE7DF" }} />
      <div className="h-[84px] animate-pulse rounded-[16px]" style={{ background: "#ECE7DF" }} />
      <div className="h-[84px] animate-pulse rounded-[16px]" style={{ background: "#ECE7DF" }} />
      <p className="mt-2 text-center text-[14px] font-semibold" style={{ color: GRAY }}>Finding your plans…</p>
    </div>
  );
}

function Cover({ plan, px, className }: { plan: Plan; px: number; className: string }) {
  const [failed, setFailed] = useState(false);
  const src = px > 300 ? plan.coverUrl : coverThumb(plan.coverUrl, px);
  return (
    <span className={`block overflow-hidden ${className}`} style={{ background: GOAL_TILE[plan.goal]?.tint ?? "#ECE8E1" }}>
      {src && !failed && <img src={src} alt="" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" data-plan-cover={plan.slug} />}
    </span>
  );
}

function Results({ plans, answers, crewDays, onClose, onOpen, onBrowse }: { plans: Plan[]; answers: QuizAnswers; crewDays: number | null; onClose: () => void; onOpen: (slug: string) => void; onBrowse: () => void }) {
  const match = useMemo(() => matchPlans(plans, answers, crewDays), [plans, answers, crewDays]);
  if (!match) return null;
  const { best, also } = match;
  const bp = best.plan;
  return (
    <>
      <div className="-mr-2 mb-3 flex items-center justify-between">
        <span className="text-[12px] font-extrabold tracking-[0.6px]" style={{ color: PURPLE }}>YOUR BEST MATCH</span>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center"><X size={22} /></button>
      </div>
      <button type="button" onClick={() => onOpen(bp.slug)} className="relative block h-[230px] w-full overflow-hidden rounded-[18px] text-left" aria-label={`Best match: ${bp.name}`}>
        <Cover plan={bp} px={1200} className="absolute inset-0 h-full w-full" />
        <span className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,10,10,0) 20%, rgba(10,10,10,.85) 100%)" }} />
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 text-white">
          <span className="text-[26px] font-extrabold leading-tight tracking-[-0.4px]">{bp.name}</span>
          <span className="text-[14px]">{bp.weeks} weeks · {bp.daysPerWeek} days a week · {bp.minutes} min</span>
          {best.why.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {best.why.map((w) => (
                <span key={w} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "rgba(20,18,24,.55)" }}>
                  <Check size={13} strokeWidth={3} aria-hidden />{w}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
      {also.length > 0 && (
        <section className="mt-6 flex flex-col gap-2.5">
          <h2 className="text-[12px] font-extrabold tracking-[0.6px]" style={{ color: "#78716C" }}>ALSO A GOOD FIT</h2>
          {also.map((r) => (
            <button key={r.plan.slug} type="button" onClick={() => onOpen(r.plan.slug)} className="flex w-full items-center gap-3 rounded-[16px] bg-white p-2.5 text-left">
              <Cover plan={r.plan} px={192} className="h-16 w-16 shrink-0 rounded-[12px]" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[16px] font-bold leading-tight">{r.plan.name}</span>
                {r.why.length > 0 && <span className="text-[13px]" style={{ color: GRAY }}>{r.why.join(" · ")}</span>}
                {r.difference && <span className="text-[13px] font-semibold" style={{ color: ORANGE }}>{r.difference}</span>}
              </span>
              <ChevronRight size={20} className="shrink-0" style={{ color: "#A8A29E" }} aria-hidden />
            </button>
          ))}
        </section>
      )}
      <BottomBar>
        <Primary onClick={() => onOpen(bp.slug)}>See this plan</Primary>
        <button type="button" onClick={onBrowse} className="mt-1 flex h-11 w-full items-center justify-center text-[15px] font-bold" style={{ color: PURPLE }}>
          Browse all plans with my answers
        </button>
      </BottomBar>
    </>
  );
}
