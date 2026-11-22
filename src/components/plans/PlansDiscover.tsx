import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, Trophy } from "lucide-react";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GOAL_CHIPS, searchPlans, suggestNextPlan, type PlanGoal } from "@/lib/workout-plans";
import { INK, MUTED, PURPLE, PURPLE_SOFT, PlanCard, useCrewPlans, useMyPlans, usePlans } from "./PlanBits";

/** Discover → Plans: your plan, what your crew is doing, and the catalog. */
export function PlansDiscover({ completeSlug, onCloseComplete }: { completeSlug?: string; onCloseComplete: () => void }) {
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePlans();
  const { data: mine } = useMyPlans();
  const { data: crew } = useCrewPlans();
  const [query, setQuery] = useState("");
  const [goal, setGoal] = useState<PlanGoal | null>(null);

  const list = useMemo(() => searchPlans(plans ?? [], query, goal), [plans, query, goal]);
  const active = mine?.active ?? null;
  const openPlan = (slug: string) => navigate({ to: "/plans/$slug", params: { slug } });

  const completed = completeSlug ? (plans ?? []).find((p) => p.slug === completeSlug) ?? null : null;
  const nextSlug = completeSlug ? suggestNextPlan(completeSlug) : null;
  const next = nextSlug ? (plans ?? []).find((p) => p.slug === nextSlug) ?? null : null;

  return (
    <div className="pb-6">
      <div className="px-4 pt-4">
        <label className="flex h-11 items-center gap-2 rounded-2xl bg-white px-4 shadow-sm">
          <Search size={18} className="shrink-0" style={{ color: MUTED }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plans"
            aria-label="Search plans"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-neutral-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="-mr-2 flex h-11 w-11 items-center justify-center"
            >
              <X size={16} style={{ color: MUTED }} />
            </button>
          )}
        </label>
      </div>

      {active && (
        <section className="px-4 pt-4">
          <div className="rounded-[20px] bg-white p-4 shadow-sm">
            <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: PURPLE }}>
              Your plan
            </div>
            <button type="button" onClick={() => openPlan(active.slug)} className="mt-1 block text-left">
              <div className="text-[20px] font-black tracking-tight" style={{ color: INK }}>
                {active.name}
              </div>
              <div className="text-[14px]" style={{ color: MUTED }}>
                Week {active.currentWeek} · Day {active.nextDay} next
              </div>
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/plans/$slug/day", params: { slug: active.slug } })}
              className="mt-3 h-12 w-full rounded-2xl text-[16px] font-semibold text-white"
              style={{ background: PURPLE }}
            >
              Start Day {active.nextDay}
            </button>
          </div>
        </section>
      )}

      {(crew ?? []).length > 0 && (
        <section className="px-4 pt-5">
          <h2 className="text-[17px] font-bold tracking-tight" style={{ color: INK }}>
            Your crew is doing
          </h2>
          <div className="mt-2 divide-y rounded-[20px] bg-white px-4 shadow-sm" style={{ borderColor: "#F0EDE9" }}>
            {(crew ?? []).map((c) => (
              <div key={c.userId} className="flex min-h-[60px] items-center gap-3 py-2" style={{ borderColor: "#F0EDE9" }}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[14px] font-bold text-white"
                  style={{ background: c.avatarColor }}
                >
                  {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : c.firstName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold" style={{ color: INK }}>
                    {c.firstName} · week {c.currentWeek} of {c.weeks}
                  </div>
                  <div className="truncate text-[13px]" style={{ color: MUTED }}>
                    {c.planName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openPlan(c.slug)}
                  className="h-11 shrink-0 rounded-full px-4 text-[14px] font-semibold"
                  style={{ background: PURPLE_SOFT, color: PURPLE }}
                >
                  See plan
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="pt-5">
        <h2 className="px-4 text-[17px] font-bold tracking-tight" style={{ color: INK }}>
          Browse by goal
        </h2>
        <div className="mt-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2" role="group" aria-label="Goals">
            {GOAL_CHIPS.map((g) => {
              const on = goal === g.goal;
              return (
                <button
                  key={g.goal}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGoal(on ? null : g.goal)}
                  className="h-11 shrink-0 rounded-full border px-4 text-[14px] font-semibold whitespace-nowrap"
                  style={{
                    borderColor: on ? PURPLE : "#E7E5E4",
                    background: on ? PURPLE_SOFT : "#FFFFFF",
                    color: on ? PURPLE : INK,
                  }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 space-y-3 px-4">
          {isLoading &&
            [0, 1, 2].map((i) => <div key={i} className="h-[132px] animate-pulse rounded-[20px] bg-white/70" />)}
          {!isLoading && list.length === 0 && (
            <div className="rounded-[20px] bg-white p-6 text-center text-[14px]" style={{ color: MUTED }}>
              No plans match{query ? ` “${query.trim()}”` : " that goal"}.
            </div>
          )}
          {list.map((p) => (
            <PlanCard key={p.id} plan={p} onOpen={() => openPlan(p.slug)} />
          ))}
        </div>
      </section>

      <Dialog open={!!completed} onOpenChange={(o) => !o && onCloseComplete()}>
        <DialogContent className="max-w-[340px] rounded-[20px] border-0 p-6 text-center">
          {completed && <ConfettiBurst />}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: PURPLE_SOFT }}>
            <Trophy size={26} color={PURPLE} />
          </div>
          <DialogTitle className="mt-2 text-[24px] font-black tracking-tight">Plan complete</DialogTitle>
          <DialogDescription className="text-[15px]" style={{ color: MUTED }}>
            You finished {completed?.name}. Every workout counted.
          </DialogDescription>
          {next && (
            <button
              type="button"
              onClick={() => {
                onCloseComplete();
                openPlan(next.slug);
              }}
              className="mt-2 w-full rounded-2xl bg-white p-3 text-left ring-1 ring-neutral-200"
            >
              <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: PURPLE }}>
                Up next
              </div>
              <div className="text-[16px] font-bold" style={{ color: INK }}>
                {next.name}
              </div>
              <div className="text-[13px]" style={{ color: MUTED }}>
                {next.weeks} weeks · {next.daysPerWeek} days a week · {next.minutes} min
              </div>
            </button>
          )}
          <button
            type="button"
            onClick={onCloseComplete}
            className="mt-1 h-12 w-full rounded-2xl text-[16px] font-semibold text-white"
            style={{ background: PURPLE }}
          >
            Done
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
