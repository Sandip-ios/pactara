import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GOAL_CHIPS, goalLabel, plansPerGoal, searchPlans, suggestNextPlan, type PlanGoal } from "@/lib/workout-plans";
import { GOAL_TILE, INK, MUTED, P, PURPLE, PURPLE_SOFT, PlanRow, useCrewPlans, useMyPlans, usePlans } from "./PlanBits";

/** Discover → Plans: what your crew is doing, goals and the catalog. Search lives in the Discover header. */
export function PlansDiscover({
  query,
  onClearQuery,
  completeSlug,
  onCloseComplete,
}: {
  query: string;
  onClearQuery: () => void;
  completeSlug?: string;
  onCloseComplete: () => void;
}) {
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePlans();
  const { data: mine } = useMyPlans();
  const { data: crew } = useCrewPlans();
  const [goal, setGoal] = useState<PlanGoal | null>(null);
  // A search looks across every plan, so it replaces the goal filter.
  const searching = query.trim().length > 0;
  useEffect(() => {
    if (searching) setGoal(null);
  }, [searching]);

  const list = useMemo(() => searchPlans(plans ?? [], query, goal), [plans, query, goal]);
  const counts = useMemo(() => plansPerGoal(plans ?? []), [plans]);
  const active = mine?.active ?? null;
  const openPlan = (slug: string) => navigate({ to: "/plans/$slug", params: { slug } });

  const completed = completeSlug ? (plans ?? []).find((p) => p.slug === completeSlug) ?? null : null;
  const nextSlug = completeSlug ? suggestNextPlan(completeSlug) : null;
  const next = nextSlug ? (plans ?? []).find((p) => p.slug === nextSlug) ?? null : null;

  const q = query.trim();
  const listTitle = q ? `Results for “${q}”` : goal ? `${goalLabel(goal)} plans` : "Popular plans";
  const filtered = !!q || !!goal;

  return (
    <>
      {(crew ?? []).length > 0 && (
        <section className="flex flex-col gap-[10px]">
          <h2 className="mx-1 text-[17px] font-extrabold">Your crew is doing</h2>
          <div className="grid grid-cols-2 gap-[10px]">
            {(crew ?? []).map((c) => (
              <button
                key={c.userId}
                type="button"
                onClick={() => openPlan(c.slug)}
                className="flex min-w-0 flex-col items-start gap-2 rounded-[16px] bg-white p-[14px] text-left"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[14px] font-bold text-white"
                  style={{ background: c.avatarColor }}
                >
                  {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : c.firstName.slice(0, 1)}
                </span>
                <span className="text-[15px] font-extrabold leading-tight">{c.planName}</span>
                <span className="text-[12px]" style={{ color: P.stone }}>
                  {c.firstName} · week {c.currentWeek} of {c.weeks}
                </span>
                <span className="text-[13px] font-bold" style={{ color: P.violet }}>
                  Try it
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-[10px]">
        <h2 className="mx-1 text-[17px] font-extrabold">Browse by goal</h2>
        <div className="grid grid-cols-2 gap-[10px]" role="group" aria-label="Goals">
          {GOAL_CHIPS.map((g) => {
            const on = goal === g.goal;
            const t = GOAL_TILE[g.goal];
            const n = counts[g.goal] ?? 0;
            return (
              <button
                key={g.goal}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  if (!on && searching) onClearQuery();
                  setGoal(on ? null : g.goal);
                }}
                className="flex h-[72px] flex-col items-start justify-center gap-0.5 rounded-[16px] px-[14px] text-left"
                style={{ background: t.tint, color: t.ink, border: `2px solid ${on ? t.ink : "transparent"}` }}
              >
                <span className="text-[15px] font-extrabold">{g.label}</span>
                <span className="text-[12px] font-semibold">
                  {n} {n === 1 ? "plan" : "plans"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-[10px]">
        <div className="mx-1 flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 truncate text-[17px] font-extrabold">{listTitle}</h2>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setGoal(null);
                onClearQuery();
              }}
              className="-my-3 flex h-11 shrink-0 items-center text-[14px] font-bold"
              style={{ color: P.violet }}
            >
              Clear
            </button>
          )}
        </div>
        {isLoading && [0, 1, 2].map((i) => <div key={i} className="h-[84px] animate-pulse rounded-[16px] bg-white/70" />)}
        {!isLoading && list.length === 0 && (
          <div className="rounded-[16px] bg-white p-6 text-center text-[14px]" style={{ color: P.stone }}>
            No plans match{q ? ` “${q}”` : " that goal"}.
          </div>
        )}
        {list.map((p) => (
          <PlanRow key={p.id} plan={p} mine={active?.slug === p.slug} onOpen={() => openPlan(p.slug)} />
        ))}
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
    </>
  );
}
