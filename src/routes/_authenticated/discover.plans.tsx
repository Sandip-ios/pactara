import { useEffect, useRef } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";
import { useMyPlans, usePlans, gearText } from "@/components/plans/PlanBits";
import { Button } from "@/components/ui/button";
import { filterPlans } from "@/lib/plan-filters";
import { NEW_GOAL_CHIPS, chipFilters, activePlanProgressLine } from "@/lib/new-discover";
import {
  DiscoverError,
  DiscoverHeader,
  DiscoverImage,
  DiscoverListSkeleton,
} from "@/components/redesign/DiscoverBits";
import { Search } from "lucide-react";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
export const Route = createFileRoute("/_authenticated/discover/plans")({
  validateSearch: (s: Record<string, unknown>): { goal?: string } =>
    typeof s["goal"] === "string" ? { goal: s["goal"] } : {},
  head: () => ({
    meta: [
      { title: "Plans · Discover · Pactara" },
      { name: "description", content: "Browse Pactara plans by goal." },
      { property: "og:title", content: "Plans · Discover · Pactara" },
      { property: "og:description", content: "Browse Pactara plans by goal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansList,
});
function PlansList() {
  const version = useAppVersion();
  const prefs = useAppPrefs();
  if (prefs.isLoading) return null;
  if (version !== "new") return <Navigate to="/groups" />;
  return <NewPlansList />;
}
function NewPlansList() {
  const scroll = useOpenAtTop();
  useStatusBarScrollToTop();
  const navigate = useNavigate({ from: "/discover/plans" });
  const { goal } = Route.useSearch();
  const chipRail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chipRail.current
      ?.querySelector("[aria-pressed=true]")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [goal]);
  const plans = usePlans();
  const mine = useMyPlans();
  const chip = NEW_GOAL_CHIPS.find((c) => c.key === goal) ?? NEW_GOAL_CHIPS[0];
  const all = plans.data ?? [];
  const active = mine.data?.active;
  const filtered = chip ? filterPlans(all, chipFilters(chip)) : all;
  const list = [...filtered].sort(
    (a, b) => Number(b.slug === active?.slug) - Number(a.slug === active?.slug),
  );
  return (
    <div
      ref={scroll}
      data-scroll-root
      className="redesign-step3 p5-discover fixed inset-0 overflow-y-auto overscroll-none"
    >
      <DiscoverHeader title="Plans" />
      <div ref={chipRail} className="p5-rail py-[14px]" role="group" aria-label="Goals">
        {NEW_GOAL_CHIPS.map((c) => (
          <Button
            key={c.key}
            variant="ghost"
            aria-pressed={chip?.key === c.key}
            className={`p5-chip ${chip?.key === c.key ? "p5-purple" : "p5-white"}`}
            onClick={(e) => {
              e.currentTarget.scrollIntoView({
                block: "nearest",
                inline: "center",
                behavior: "smooth",
              });
              void navigate({ search: c.key === "all" ? {} : { goal: c.key }, replace: true });
            }}
          >
            {c.label}
          </Button>
        ))}
      </div>
      <div className="px-4 flex flex-col gap-[10px]">
        {plans.isPending ? (
          <DiscoverListSkeleton />
        ) : plans.isError ? (
          <DiscoverError kind="plans" retry={() => void plans.refetch()} />
        ) : !list.length ? (
          <div className="p5-error p5-empty">
            <span className="p5-empty-icon p5-soft">
              <Search />
            </span>
            <h2>No {chip?.key === "run" ? "running" : chip?.label.toLowerCase()} plans yet</h2>
            <p>Try another goal, or see every plan.</p>
            <Button
              variant="ghost"
              className="p5-purple rounded-full h-11 mt-4"
              onClick={() => void navigate({ search: {}, replace: true })}
            >
              See all plans
            </Button>
          </div>
        ) : (
          list.map((p) => (
            <Button
              key={p.id}
              variant="ghost"
              className="p5-card p5-plan-row w-full rounded-[16px] p-3 gap-3"
              onClick={() => void navigate({ to: "/plans/$slug", params: { slug: p.slug } })}
            >
              <DiscoverImage url={p.coverUrl} className="h-[84px] w-[84px] rounded-[12px]" />
              <span className="min-w-0 flex-1">
                {active?.slug === p.slug && (
                  <span className="p5-soft inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold">
                    YOUR PLAN
                  </span>
                )}
                <strong className="p5-title block line-clamp-2">{p.name}</strong>
                <span className="p5-meta block">
                  {p.weeks} weeks · {p.daysPerWeek} days a week · {p.minutes} min
                </span>
                <span className="p5-small block font-semibold">
                  {p.gearShort ?? gearText(p)} · {p.level}
                </span>
                {active?.slug === p.slug && (
                  <span className="p5-small block">{activePlanProgressLine(active)}</span>
                )}
              </span>
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
