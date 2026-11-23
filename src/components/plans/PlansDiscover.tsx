import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Sparkles, Trophy, X } from "lucide-react";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { listMyGroups } from "@/lib/groups.functions";
import { weeklyTarget } from "@/lib/streak-rules";
import { searchPlans, suggestNextPlan } from "@/lib/workout-plans";
import {
  FILTER_DEFS,
  FILTER_KEYS,
  GOAL_TILES,
  NO_FILTERS,
  activeFilterCount,
  chipValue,
  crewDaysNote,
  filterPlans,
  plansCountLabel,
  sortForDiscover,
  tileCount,
  tileFilters,
  tileIsOn,
  type FilterKey,
  type PlanFilters,
} from "@/lib/plan-filters";
import { GOAL_TILE, INK, MUTED, P, PURPLE, PURPLE_SOFT, PlanCard, useMyPlans, usePlans } from "./PlanBits";
import { PlanFilterSheet } from "./PlanFilterSheet";

/** Discover: goal tiles, then All plans with filter chips. Search lives in the Discover header. */
export function PlansDiscover({
  query,
  onClearQuery,
  filters,
  onFiltersChange,
  completeSlug,
  onCloseComplete,
  scrollToList = false,
  onScrolledToList,
}: {
  query: string;
  onClearQuery: () => void;
  filters: PlanFilters;
  onFiltersChange: (f: PlanFilters) => void;
  completeSlug?: string;
  onCloseComplete: () => void;
  scrollToList?: boolean;
  onScrolledToList?: () => void;
}) {
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePlans();
  const { data: mine } = useMyPlans();
  const [sheet, setSheet] = useState<FilterKey | null>(null);
  const allRef = useRef<HTMLElement>(null);
  const daysOn = filters.days.length > 0;
  const { data: groupsData } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
    staleTime: 60_000,
    enabled: daysOn,
  });

  const all = plans ?? [];

  // Arriving from the quiz with its answers as filters: open at the All plans list.
  useEffect(() => {
    if (!scrollToList || isLoading) return;
    requestAnimationFrame(() => {
      allRef.current?.scrollIntoView({ block: "start" });
      onScrolledToList?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToList, isLoading]);
  const searched = useMemo(() => searchPlans(all, query), [all, query]);
  const activeSlug = mine?.active?.slug ?? null;
  const list = useMemo(() => sortForDiscover(filterPlans(searched, filters), activeSlug), [searched, filters, activeSlug]);
  const openPlan = (slug: string) => navigate({ to: "/plans/$slug", params: { slug } });

  const q = query.trim();
  const nFilters = activeFilterCount(filters);
  const narrowed = nFilters > 0 || q.length > 0;
  const crewNote = daysOn
    ? crewDaysNote(
        filters.days,
        (groupsData?.groups ?? []).map((g) => weeklyTarget({ frequency: g.frequency, days_per_week: g.daysPerWeek })),
      )
    : null;

  const clearAll = () => {
    onFiltersChange(NO_FILTERS);
    onClearQuery();
  };
  const setFilter = (key: FilterKey, values: string[]) => onFiltersChange({ ...filters, [key]: values });

  const completed = completeSlug ? all.find((p) => p.slug === completeSlug) ?? null : null;
  const nextSlug = completeSlug ? suggestNextPlan(completeSlug) : null;
  const next = nextSlug ? all.find((p) => p.slug === nextSlug) ?? null : null;

  return (
    <>
      {mine && !mine.active && (
        <Link
          to="/find-plan"
          className="flex items-center gap-3 rounded-[16px] p-[14px]"
          style={{ background: "#EDE7FB" }}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: "#7C3AED" }} aria-hidden>
            <Sparkles size={22} color="#FFFFFF" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[16px] font-extrabold" style={{ color: "#4C1D95" }}>
              Not sure? Find your plan
            </span>
            <span className="text-[13px] font-medium" style={{ color: "#5B21B6" }}>
              4 quick questions, then we pick for you
            </span>
          </span>
          <ChevronRight size={20} className="shrink-0" style={{ color: "#5B21B6" }} aria-hidden />
        </Link>
      )}

      <section className="flex flex-col gap-[10px]">
        <h2 className="mx-1 text-[17px] font-extrabold">Browse by goal</h2>
        <div className="grid grid-cols-2 gap-[10px]" role="group" aria-label="Goals">
          {GOAL_TILES.map((t) => {
            const on = tileIsOn(filters, t);
            const c = GOAL_TILE[t.key];
            const n = tileCount(all, t);
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onClearQuery();
                  onFiltersChange(on ? NO_FILTERS : tileFilters(t));
                  if (!on) requestAnimationFrame(() => allRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
                className="flex h-[72px] flex-col items-start justify-center gap-0.5 rounded-[16px] px-[14px] text-left"
                style={{ background: c.tint, color: c.ink, border: `2px solid ${on ? c.ink : "transparent"}` }}
              >
                <span className="text-[15px] font-extrabold">{t.label}</span>
                <span className="text-[12px] font-semibold">{isLoading ? " " : plansCountLabel(n)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        ref={allRef}
        className="flex flex-col gap-[10px]"
        style={{ scrollMarginTop: "max(16px, calc(env(safe-area-inset-top) + 8px))" }}
      >
        <div className="mx-1 flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-extrabold">All plans</h2>
          {!isLoading && (
            <span className="text-[14px] font-semibold" style={{ color: P.stone }}>
              {plansCountLabel(all.length)}
            </span>
          )}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filters">
          {FILTER_KEYS.map((k) => {
            const value = chipValue(k, filters[k]);
            const def = FILTER_DEFS[k];
            if (!value) {
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSheet(k)}
                  className="flex h-11 shrink-0 items-center gap-1 rounded-full bg-white pl-4 pr-3 text-[14px] font-bold"
                  style={{ border: `1.5px solid ${P.line}`, color: P.ink }}
                >
                  {def.chip}
                  <ChevronDown size={16} style={{ color: MUTED }} aria-hidden />
                </button>
              );
            }
            return (
              <span key={k} className="flex h-11 shrink-0 items-center rounded-full text-[14px] font-bold" style={{ background: P.ink, color: "#FFFFFF" }}>
                <button type="button" onClick={() => setSheet(k)} className="flex h-full items-center pl-4 pr-1" aria-label={`${def.chip}: ${value}`}>
                  {value}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter(k, [])}
                  className="flex h-11 w-10 items-center justify-center rounded-full"
                  aria-label={`Remove ${def.chip} filter`}
                >
                  <X size={16} aria-hidden />
                </button>
              </span>
            );
          })}
        </div>

        {narrowed && !isLoading && (
          <div className="mx-1 flex items-center justify-between gap-3">
            <span className="text-[14px] font-semibold" style={{ color: P.stone }}>
              {list.length} {list.length === 1 ? "plan matches" : "plans match"}
            </span>
            <button type="button" onClick={clearAll} className="-my-3 flex h-11 items-center text-[14px] font-bold" style={{ color: P.violet }}>
              Clear all
            </button>
          </div>
        )}

        {isLoading && [0, 1, 2].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-[16px] bg-white/70" />)}
        {!isLoading && list.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-[16px] bg-white p-6 text-center">
            <p className="text-[15px] font-semibold" style={{ color: P.ink }}>
              No plans match. Try removing a filter.
            </p>
            <button type="button" onClick={clearAll} className="flex h-11 items-center px-3 text-[15px] font-bold" style={{ color: P.violet }}>
              Clear all
            </button>
          </div>
        )}
        {list.map((p) => (
          <PlanCard key={p.id} plan={p} mine={activeSlug === p.slug} onOpen={() => openPlan(p.slug)} />
        ))}
        {crewNote && list.length > 0 && (
          <p className="rounded-[16px] px-4 py-3 text-[14px] leading-snug" style={{ background: P.violetTint, color: P.violetText }}>
            {crewNote}
          </p>
        )}
      </section>

      <PlanFilterSheet
        filterKey={sheet}
        plans={searched}
        filters={filters}
        onClose={() => setSheet(null)}
        onApply={(k, v) => {
          setFilter(k, v);
          setSheet(null);
        }}
      />

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
