import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, Sparkles, X, Zap } from "lucide-react";
import { coverThumb, filterPlans, type PlanFilters } from "@/lib/plan-filters";
import { searchPlans, type Plan } from "@/lib/workout-plans";
import { matchPlans } from "@/lib/plan-quiz";
import { listMyGroups } from "@/lib/groups.functions";
import { weeklyTarget } from "@/lib/streak-rules";
import { quizSearchFor, showQuizMatchCard, type SavedQuiz } from "@/lib/plan-quiz-saved";
import { getPlanCrewmate } from "@/lib/new-discover.functions";
import {
  NEW_GOAL_CHIPS,
  activePlanProgressLine,
  chipFilters,
  crewmateOnPlanLine,
  plansWithoutActive,
  selectedChipKey,
  type DiscoverTab,
} from "@/lib/new-discover";
import { gearText, useMyPlans, usePlans } from "@/components/plans/PlanBits";
import { useSavedQuiz } from "@/components/plans/QuizMatchCard";
import { NewAvatarFallback } from "./NewAvatarFallback";

const BG = "#F5F2EC";
const INK = "#1C1917";
const PURPLE = "#7C3AED";

export function NewDiscover({
  tab,
  onTab,
  filters,
  onFiltersChange,
}: {
  tab: DiscoverTab;
  onTab: (t: DiscoverTab) => void;
  filters: PlanFilters;
  onFiltersChange: (f: PlanFilters) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <div data-scroll-root className="fixed inset-0 w-full overflow-y-auto overscroll-none" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif", color: INK }}>
      <div className="flex flex-col gap-4 px-4 pb-[130px] pt-new-top">
        <h1 className="text-[28px] font-extrabold tracking-[-0.5px]">Discover</h1>
        <label className="flex h-[46px] items-center gap-[10px] rounded-[14px] px-[14px]" style={{ background: "#ECE8E1" }}>
          <Search size={18} className="shrink-0" style={{ color: "#78716C" }} aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workouts and plans"
            aria-label="Search workouts and plans"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#78716C]"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="-mr-2 flex h-11 w-11 items-center justify-center">
              <X size={16} style={{ color: "#78716C" }} />
            </button>
          )}
        </label>
        <div role="tablist" aria-label="Discover sections" className="grid grid-cols-2 rounded-[12px] p-[3px]" style={{ background: "#ECE8E1" }}>
          {(["workouts", "plans"] as const).map((t) => {
            const on = tab === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={on}
                type="button"
                onClick={() => onTab(t)}
                className="h-9 rounded-[10px] text-[14px]"
                style={{ background: on ? "#FFFFFF" : "transparent", color: on ? INK : "#78716C", fontWeight: on ? 800 : 600, boxShadow: on ? "0 1px 2px rgba(0,0,0,.08)" : undefined }}
              >
                {t === "workouts" ? "Workouts" : "Plans"}
              </button>
            );
          })}
        </div>
        {tab === "workouts" ? (
          <p className="rounded-[18px] bg-white px-4 py-8 text-center text-[15px] font-semibold" style={{ color: "#57534E" }}>
            Workouts are coming in this update.
          </p>
        ) : (
          <PlansTab query={query} filters={filters} onFiltersChange={onFiltersChange} />
        )}
      </div>
    </div>
  );
}

function PlansTab({ query, filters, onFiltersChange }: { query: string; filters: PlanFilters; onFiltersChange: (f: PlanFilters) => void }) {
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePlans();
  const { data: mine } = useMyPlans();
  const { data: savedQuiz, isPending: quizPending } = useSavedQuiz();
  const all = plans ?? [];
  const active = mine?.active ?? null;
  const activePlan = active ? all.find((p) => p.slug === active.slug) ?? null : null;
  const list = useMemo(
    () => plansWithoutActive(filterPlans(searchPlans(all, query), filters), active?.slug ?? null),
    [all, query, filters, active?.slug],
  );
  const chipOn = selectedChipKey(filters);
  const openPlan = (slug: string) => navigate({ to: "/plans/$slug", params: { slug } });
  const showMatch = !!mine && !quizPending && !!savedQuiz && showQuizMatchCard(savedQuiz, !!active);

  return (
    <>
      <p className="text-[14px] leading-snug" style={{ color: "#57534E" }}>
        A plan is a few weeks of workouts. It tells you what to do each day.
      </p>
      {active && activePlan && (
        <ActivePlanCard plan={activePlan} line={activePlanProgressLine({ ...active, daysPerWeek: activePlan.daysPerWeek })} onOpen={() => openPlan(activePlan.slug)} />
      )}
      {mine && !quizPending && (showMatch && savedQuiz ? <MatchCard saved={savedQuiz} plans={all} /> : <QuizCard onOpen={() => navigate({ to: "/find-plan" })} />)}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Goals">
        {NEW_GOAL_CHIPS.map((c) => {
          const on = chipOn === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => onFiltersChange(chipFilters(c))}
              className="h-9 shrink-0 rounded-full px-4 text-[14px] font-bold"
              style={on ? { background: PURPLE, color: "#FFFFFF" } : { background: "#FFFFFF", color: INK, border: "1px solid #E7E3DE" }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-3">
        {isLoading && [0, 1, 2].map((i) => <div key={i} className="h-[108px] animate-pulse rounded-[18px] bg-white/70" />)}
        {!isLoading && list.length === 0 && (
          <p className="rounded-[18px] bg-white px-4 py-6 text-center text-[15px] font-semibold" style={{ color: "#57534E" }}>
            No plans match. Try another goal.
          </p>
        )}
        {list.map((p) => (
          <button key={p.id} type="button" onClick={() => openPlan(p.slug)} className="flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left active:scale-[0.99]">
            <Cover plan={p} />
            <PlanText plan={p} />
          </button>
        ))}
      </div>
    </>
  );
}

function Cover({ plan }: { plan: Plan }) {
  const [failed, setFailed] = useState(false);
  const src = coverThumb(plan.coverUrl);
  if (!src || failed) {
    return (
      <span className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-[12px]" style={{ background: "#FEF3C7" }}>
        <Zap size={28} style={{ color: "#92400E" }} aria-hidden />
      </span>
    );
  }
  return (
    <span className="block h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[12px]" style={{ background: "#ECE8E1" }}>
      <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" data-plan-cover={plan.slug} />
    </span>
  );
}

function PlanText({ plan, line }: { plan: Plan; line?: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
      <span className="text-[17px] font-bold leading-tight">{plan.name}</span>
      <span className="text-[14px]" style={{ color: "#44403C" }}>
        {line ?? `${plan.weeks} weeks · ${plan.daysPerWeek} days a week · ${plan.minutes} min`}
      </span>
      <span className="line-clamp-2 text-[13px] font-semibold" style={{ color: "#57534E" }}>
        {plan.gearShort ?? gearText(plan)} · {plan.level}
      </span>
    </span>
  );
}

function ActivePlanCard({ plan, line, onOpen }: { plan: Plan; line: string; onOpen: () => void }) {
  const { data: mate } = useQuery({
    queryKey: ["plan-crewmate", plan.id],
    queryFn: () => getPlanCrewmate({ data: { planId: plan.id } }),
    staleTime: 60_000,
  });
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-col gap-2 rounded-[18px] bg-white p-3 text-left active:scale-[0.99]">
      <span className="flex w-full items-center gap-3">
        <Cover plan={plan} />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
          <span className="rounded-full px-2 py-[2px] text-[11px] font-bold uppercase tracking-[0.4px]" style={{ background: "#EDE4FF", color: "#6D28D9" }}>
            Your plan
          </span>
          <span className="text-[17px] font-bold leading-tight">{plan.name}</span>
          <span className="text-[14px]" style={{ color: "#44403C" }}>{line}</span>
          <span className="line-clamp-2 text-[13px] font-semibold" style={{ color: "#57534E" }}>
            {plan.gearShort ?? gearText(plan)} · {plan.level}
          </span>
        </span>
      </span>
      {mate && (
        <span className="flex items-center gap-2" data-crewmate-line>
          <span className="block h-5 w-5 shrink-0 overflow-hidden rounded-full" style={{ background: "#E4DAFB", color: "#F8F5FF" }}>
            {mate.avatarUrl ? <img src={mate.avatarUrl} alt="" className="h-full w-full object-cover" /> : <NewAvatarFallback />}
          </span>
          <span className="truncate text-[13px] font-semibold" style={{ color: "#6D28D9" }}>
            {crewmateOnPlanLine(mate.firstName, mate.crewName)}
          </span>
        </span>
      )}
    </button>
  );
}

const GRADIENT = "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)";

function QuizCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-[18px] p-[14px] text-left" style={{ background: GRADIENT }}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "rgba(255,255,255,.18)" }}>
        <Sparkles size={22} color="#FFFFFF" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[16px] font-bold" style={{ color: "#FFFFFF" }}>Not sure which plan?</span>
        <span className="text-[13px]" style={{ color: "rgba(255,255,255,.8)" }}>Answer 4 quick questions and we'll match you</span>
      </span>
      <ChevronRight size={20} color="#FFFFFF" className="shrink-0" aria-hidden />
    </button>
  );
}

function MatchCard({ saved, plans }: { saved: SavedQuiz; plans: Plan[] }) {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["my-groups"], queryFn: () => listMyGroups(), staleTime: 60_000 });
  const targets = (data?.groups ?? []).map((g) => weeklyTarget({ frequency: g.frequency, days_per_week: g.daysPerWeek }));
  const crewDays = targets.length ? Math.max(...targets) : null;
  const match = useMemo(() => (plans.length ? matchPlans(plans, saved.answers, crewDays) : null), [plans, saved, crewDays]);
  if (!match) return null;
  const bp = match.best.plan;
  return (
    <section className="flex flex-col gap-2 rounded-[18px] p-[14px]" style={{ background: GRADIENT }} aria-label="Your best match">
      <span className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.6px]" style={{ color: "rgba(255,255,255,.8)" }}>Your best match</span>
        <button type="button" onClick={() => navigate({ to: "/find-plan", search: quizSearchFor(saved.answers, 1) })} className="-my-1 min-h-8 px-1 text-[13px] font-bold" style={{ color: "#FFFFFF" }}>
          Retake quiz
        </button>
      </span>
      <button type="button" onClick={() => navigate({ to: "/plans/$slug", params: { slug: bp.slug } })} className="flex w-full items-center gap-3 text-left">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "rgba(255,255,255,.18)" }}>
          <Sparkles size={22} color="#FFFFFF" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[16px] font-bold" style={{ color: "#FFFFFF" }}>{bp.name}</span>
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,.8)" }}>
            {bp.weeks} weeks · {bp.daysPerWeek} days a week · {bp.minutes} min
          </span>
        </span>
        <ChevronRight size={20} color="#FFFFFF" className="shrink-0" aria-hidden />
      </button>
      <button type="button" onClick={() => navigate({ to: "/find-plan", search: quizSearchFor(saved.answers, 5) })} className="self-start min-h-8 text-[13px] font-bold underline" style={{ color: "#FFFFFF" }}>
        See all {1 + match.also.length} matches
      </button>
    </section>
  );
}
