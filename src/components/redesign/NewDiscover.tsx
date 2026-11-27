import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, Sparkle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/workout-plans";
import { matchPlans } from "@/lib/plan-quiz";
import { listMyGroups } from "@/lib/groups.functions";
import { weeklyTarget } from "@/lib/streak-rules";
import { quizSearchFor, type SavedQuiz } from "@/lib/plan-quiz-saved";
import { discoverCardMatch } from "@/lib/new-quiz";
import { useMyPlans, usePlans } from "@/components/plans/PlanBits";
import { planGearLevelLine } from "@/lib/new-discover";
import { cardByline } from "@/lib/discover-workouts";
import { useSavedQuiz } from "@/components/plans/QuizMatchCard";
import { discoverTopCard, popularPlans, showDiscoverRow } from "@/lib/discover-page";
import { getDiscoverPlanStarts } from "@/lib/discover-page.functions";
import { useDiscoverWorkouts } from "./NewDiscoverWorkouts";
import { DiscoverError, DiscoverImage } from "./DiscoverBits";
import { DiscoverSearch } from "./DiscoverSearch";
import { DiscoverWorkoutSheet } from "./DiscoverWorkoutSheet";
import type { DiscoverCard } from "@/lib/discover-workouts";
import { useOpenAtTop } from "@/lib/use-open-at-top";
const PURPLE = "var(--new-purple)";

export function NewDiscover() {
  const scroll = useOpenAtTop();
  const navigate = useNavigate();
  const plans = usePlans();
  const mine = useMyPlans();
  const quiz = useSavedQuiz();
  const starts = useQuery({
    queryKey: ["discover-plan-starts"],
    queryFn: () => getDiscoverPlanStarts(),
  });
  const workouts = useDiscoverWorkouts(
    { muscle: "all", equipment: null, time: null, sort: "saved", q: "" },
    false,
  );
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<DiscoverCard | null>(null);
  const all = plans.data ?? [];
  const active = mine.data?.active;
  const activePlan = all.find((p) => p.slug === active?.slug);
  const top = discoverTopCard(!!active, !!quiz.data);
  const row = popularPlans(all, starts.data ?? {}, active?.slug ?? null);
  const cards = (workouts.data?.pages[0]?.items ?? []).slice(0, 10);
  const mostStarted = popularPlans(all, starts.data ?? {}, null)[0];
  const openPlan = (slug: string) => void navigate({ to: "/plans/$slug", params: { slug } });
  return (
    <div
      ref={scroll}
      data-scroll-root
      className="redesign-step3 p5-discover fixed inset-0 overflow-y-auto overscroll-none"
    >
      <header className="p5-white px-4 pb-[14px] pt-new-top">
        <h1 className="text-[26px] font-extrabold leading-[30px]">Discover</h1>
        <div className="mt-[13px] flex gap-3 items-center">
          <label className={`p5-search${focused ? " p5-search-open" : ""}`}>
            <Search size={18} />
            <input
              placeholder="Search workouts, plans, people"
              aria-label="Search workouts, plans, people"
              value={query}
              onFocus={() => setFocused(true)}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") window.dispatchEvent(new Event("discover-search-submit"));
              }}
            />
            {query && (
              <Button
                variant="ghost"
                className="p5-icon -mr-3"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X />
              </Button>
            )}
          </label>
          {focused && (
            <Button
              variant="ghost"
              className="p5-link"
              onClick={() => {
                setQuery("");
                setFocused(false);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </header>
      {focused ? (
        <DiscoverSearch query={query} onQuery={setQuery} plans={all} onWorkout={setOpened} />
      ) : (
        <>
          <div className="px-4 pt-4">
            {plans.isPending || mine.isPending || quiz.isPending ? (
              <div className="p5-skeleton h-[80px] animate-pulse" />
            ) : top === "onPlan" ? (
              active &&
              activePlan && (
                <Button
                  variant="ghost"
                  className="p5-card p5-active-card w-full gap-3 rounded-[16px] px-3 py-[10px]"
                  onClick={() => openPlan(activePlan.slug)}
                >
                  <DiscoverImage url={activePlan.coverUrl} className="h-12 w-12 rounded-[10px]" />
                  <span className="min-w-0 flex-1">
                    <span className="text-[11px] font-extrabold text-[var(--new-purple)]">
                      YOUR PLAN
                    </span>
                    <span className="p5-title block text-[15px] line-clamp-2">
                      {activePlan.name}
                    </span>
                    <span className="p5-small block">
                      Week {active.currentWeek} of {active.weeks} · Today:{" "}
                      {activePlan.days.find(
                        (d) =>
                          d.dayNumber === active.nextDay &&
                          (!d.weekNumber || d.weekNumber === active.currentWeek),
                      )?.title ?? "Workout"}
                    </span>
                  </span>
                  <ChevronRight className="shrink-0" />
                </Button>
              )
            ) : top === "quizTaken" && quiz.data ? (
              <MatchCard saved={quiz.data} plans={all} activeSlug={null} />
            ) : (
              <QuizCard onOpen={() => void navigate({ to: "/find-plan" })} />
            )}
          </div>
          {showDiscoverRow(row.length, plans.isPending, plans.isError) && (
            <section>
              <SectionHeader
                title="Plans"
                subtitle="A few weeks of workouts, day by day"
                onAll={() => void navigate({ to: "/discover/plans" })}
              />
              {plans.isError ? (
                <div className="px-4">
                  <DiscoverError kind="plans" retry={() => void plans.refetch()} />
                </div>
              ) : (
                <div className="p5-rail">
                  {plans.isPending
                    ? [0, 1].map((i) => (
                        <div key={i} className="p5-skeleton h-[250px] w-[260px] animate-pulse" />
                      ))
                    : row.map((p) => (
                        <Button
                          variant="ghost"
                          key={p.id}
                          className="p5-card p5-plan-card"
                          onClick={() => openPlan(p.slug)}
                        >
                          <DiscoverImage url={p.coverUrl} fallbackSize={32} className="h-[150px] w-full" />
                          {p.id === mostStarted?.id && (starts.data?.[p.id] ?? 0) > 0 && (
                            <span className="p5-white absolute left-3 top-3 rounded-full px-2 py-1 text-[10px] font-extrabold">
                              POPULAR
                            </span>
                          )}
                          <span className="p5-card-body block px-[14px] pt-3 pb-[14px]">
                            <span className="p5-title line-clamp-2">{p.name}</span>
                            <span className="p5-meta block">
                              {p.weeks} weeks · {p.daysPerWeek} days a week · {p.minutes} min
                            </span>
                            <span className="p5-small block font-semibold">
                              {planGearLevelLine(p)}
                            </span>
                          </span>
                        </Button>
                      ))}
                </div>
              )}
            </section>
          )}
          {showDiscoverRow(cards.length, workouts.isPending, workouts.isError) && (
            <section>
              <SectionHeader
                title="Workouts"
                subtitle="One session you can do today"
                onAll={() => void navigate({ to: "/discover/workouts" })}
              />
              {workouts.isError ? (
                <div className="px-4">
                  <DiscoverError kind="workouts" retry={() => void workouts.refetch()} />
                </div>
              ) : (
                <div className="p5-rail">
                  {workouts.isPending
                    ? [0, 1, 2].map((i) => (
                        <div key={i} className="p5-skeleton h-[216px] w-[168px] animate-pulse" />
                      ))
                    : cards.map((c) => (
                        <Button
                          key={c.code}
                          variant="ghost"
                          className="p5-card p5-workout-card"
                          onClick={() => setOpened(c)}
                        >
                          <DiscoverImage url={c.coverUrl} fallbackSize={32} className="h-[124px] w-full" />
                          <span className="p5-card-body block p-3">
                            <span className="p5-title text-[15px] line-clamp-2">{c.name}</span>
                            <span className="p5-small block">
                              {c.exercises} {c.exercises === 1 ? "exercise" : "exercises"} ·{" "}
                              {c.minutes} min
                            </span>
                            <span className="p5-small block">
                              by {c.author}{cardByline(c).saves}
                            </span>
                          </span>
                        </Button>
                      ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
      {opened && <DiscoverWorkoutSheet card={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
function SectionHeader({
  title,
  subtitle,
  onAll,
}: {
  title: string;
  subtitle: string;
  onAll: () => void;
}) {
  return (
    <div className="p5-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <Button variant="ghost" className="p5-link shrink-0 text-[14px]" onClick={onAll}>
        See all <ChevronRight />
      </Button>
    </div>
  );
}
function QuizCard({ onOpen }: { onOpen: () => void }) {
  return (
    <Button variant="ghost" className="p5-quiz" onClick={onOpen}>
      <Sparkle className="size-[22px]! shrink-0" />
      <span className="min-w-0 flex-1">
        <strong className="block text-[16px] font-extrabold">Not sure which plan?</strong>
        <span className="block text-[13px]">Answer 4 quick questions and we'll match you</span>
      </span>
      <ChevronRight />
    </Button>
  );
}
export function MatchCard({
  saved,
  plans,
  activeSlug,
}: {
  saved: SavedQuiz;
  plans: Plan[];
  activeSlug: string | null;
}) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
    staleTime: 60_000,
  });
  const targets = (data?.groups ?? []).map((g) =>
    weeklyTarget({ frequency: g.frequency, days_per_week: g.daysPerWeek }),
  );
  const crewDays = targets.length ? Math.max(...targets) : null;
  const match = useMemo(
    () => (plans.length ? matchPlans(plans, saved.answers, crewDays) : null),
    [plans, saved, crewDays],
  );
  if (!match) return null;
  const shown = discoverCardMatch(match, activeSlug);
  const bp = shown.plan;
  const open = () => navigate({ to: "/plans/$slug", params: { slug: bp.slug } });
  return (
    <section
      className="flex flex-col gap-2 rounded-[18px] p-[14px]"
      style={{ background: "var(--new-soft)" }}
      aria-label="Your best match"
    >
      <span className="flex items-center justify-between">
        <span
          className="text-[12px] font-extrabold uppercase tracking-[0.6px]"
          style={{ color: PURPLE }}
        >
          Your best match
        </span>
        <button
          type="button"
          onClick={() => navigate({ to: "/find-plan", search: quizSearchFor(saved.answers, 1) })}
          className="-my-2 min-h-10 px-1 text-[13px] font-bold"
          style={{ color: PURPLE }}
        >
          Retake quiz
        </button>
      </span>
      <button type="button" onClick={open} className="flex w-full items-center gap-3 text-left">
        <DiscoverImage url={bp.coverUrl} className="h-14 w-14 rounded-[12px]" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[16px] font-extrabold leading-tight">{bp.name}</span>
          <span className="text-[13px]" style={{ color: "var(--new-muted)" }}>
            {bp.weeks} weeks · {bp.daysPerWeek} days a week · {bp.minutes} min
          </span>
          {shown.why.length > 0 && (
            <span
              className="text-[12px] font-bold line-clamp-1"
              style={{ color: "var(--new-purple-text)" }}
            >
              {shown.why.slice(0, 2).join(" · ")}
            </span>
          )}
        </span>
        <ChevronRight
          size={20}
          className="shrink-0"
          style={{ color: "var(--new-purple-text)" }}
          aria-hidden
        />
      </button>
      <span className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={open}
          className="h-11 rounded-full text-[15px] font-bold"
          style={{ background: PURPLE, color: "var(--new-white)" }}
        >
          See plan
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/find-plan", search: quizSearchFor(saved.answers, 5) })}
          className="h-11 rounded-full bg-[var(--new-white)] text-[15px] font-bold"
          style={{ color: PURPLE }}
        >
          See all {1 + match.also.length} matches
        </button>
      </span>
    </section>
  );
}
