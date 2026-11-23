import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, MoreHorizontal, Play, Plus, Trophy } from "lucide-react";
import { useOpenAtTop } from "@/lib/use-open-at-top";
import { useStatusBarScrollToTop } from "@/lib/status-bar-scroll";
import { usePlans, useMyPlans } from "@/components/plans/PlanBits";
import { LeavePlanSheet, PlanOptionsSheet, planWeekTitle } from "@/components/plans/PlanSheets";
import { SavedRow, useMyWorkoutsFlow } from "@/components/workout/MyWorkoutsFlow";
import { ExerciseThumb, FONT, W } from "@/components/workout/WorkoutBits";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useLiftHistory, useMyWorkouts } from "@/lib/exercise-library";
import { plural } from "@/lib/lift-rules";
import { dayForWeek, dayMinutes, movesForWeek, weekNoteFor } from "@/lib/workout-plans";
import { localDateIn } from "@/lib/streak-rules";
import { LIFTS_SHOWN, fmtLiftTime, liftsToggleLabel, recentDate, recentMeta, sessionKicker } from "@/lib/workouts-tab";
import { getWorkoutsOverview, type RecentSession } from "@/lib/workouts-tab.functions";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/workouts")({
  head: () => ({
    meta: [
      { title: "Workouts · Pactara" },
      { name: "description", content: "Your plan, saved workouts, recent sessions and lifts in one place." },
      { property: "og:title", content: "Workouts · Pactara" },
      { property: "og:description", content: "Your plan, saved workouts, recent sessions and lifts in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkoutsTab,
});

const CARD_SHADOW = "0 1px 2px rgba(20,18,24,.06)";

function WorkoutsTab() {
  const scrollRef = useOpenAtTop();
  useStatusBarScrollToTop();
  const navigate = useNavigate();
  const { data: plans } = usePlans();
  const { data: mine } = useMyPlans();
  const { data: workouts } = useMyWorkouts();
  const { data: history } = useLiftHistory();
  const { data: overview } = useQuery({ queryKey: ["workouts-overview"], queryFn: () => getWorkoutsOverview(), staleTime: 0 });
  const { lib, start, busy, run, editWorkout, startBuild, overlays } = useMyWorkoutsFlow();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [openSession, setOpenSession] = useState<RecentSession | null>(null);
  const [allLifts, setAllLifts] = useState(false);

  const active = mine?.active ?? null;
  const plan = active ? plans?.find((p) => p.slug === active.slug) ?? null : null;
  const day = plan && active ? dayForWeek(plan, active.nextDay, active.currentWeek) : null;
  const moves = plan && day && active ? movesForWeek(day.moves, weekNoteFor(plan, active.currentWeek)?.lighter ?? false) : [];
  const timezone = overview?.timezone ?? history?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = overview?.today ?? history?.today ?? localDateIn(timezone);
  const lifts = (overview?.lifts ?? []).filter((l) => lib.has(l.exerciseId));
  const shownLifts = allLifts ? lifts : lifts.slice(0, LIFTS_SHOWN);
  const week = overview?.week;

  const doAgain = (s: RecentSession) => {
    const exercises = s.again.filter((e) => lib.has(e.exerciseId));
    if (!exercises.length) return;
    setOpenSession(null);
    run(() => start.startSaved({ id: s.workoutId, name: s.title, exercises }));
  };

  return (
    <div ref={scrollRef} className="fixed inset-0 w-full overflow-y-auto overscroll-none" data-scroll-root style={{ background: W.bg, color: W.ink, fontFamily: FONT }}>
      <header className="px-4 pb-1" style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}>
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.6px]">Workouts</h1>
      </header>
      <div className="flex flex-col gap-[22px] px-4 pb-[130px] pt-[14px]">
        {active && plan && day ? (
          <div className="relative rounded-[20px] text-white" style={{ background: W.violetDeep }}>
            <Link to="/plans/$slug/day" params={{ slug: plan.slug }} className="flex flex-col gap-3.5 p-[18px]" aria-label={`Today's plan workout: ${day.title}`}>
              <span className="flex min-h-7 items-center gap-2 pr-11">
                <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: "#DDD6FE" }}>
                  WEEK {active.currentWeek} · DAY {active.nextDay}
                </span>
                <span className="min-w-0 truncate rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "rgba(255,255,255,.16)" }}>
                  {plan.name}
                </span>
              </span>
              <span className="flex items-end justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[22px] font-extrabold leading-tight tracking-[-0.4px]">{day.title}</span>
                  <span className="text-[14px]" style={{ color: "#EDE9FE" }}>
                    {plural(moves.length, "exercise")} · about {dayMinutes(day, plan)} min
                  </span>
                </span>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: W.violetDeep }} aria-hidden>
                  <Play size={20} fill="currentColor" />
                </span>
              </span>
            </Link>
            <button
              type="button"
              aria-label="Plan options"
              onClick={() => setOptionsOpen(true)}
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-[22px] text-white"
              style={{ background: "rgba(255,255,255,.14)" }}
            >
              <MoreHorizontal size={22} />
            </button>
          </div>
        ) : mine && !active ? (
          <Link
            to="/groups"
            search={{ tab: "plans" }}
            className="flex items-center gap-3.5 rounded-[20px] bg-white p-4"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[22px]" style={{ background: W.lilacSoft }} aria-hidden>
              🗺️
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-extrabold">Follow a plan</span>
              <span className="block text-[13px]" style={{ color: W.stone }}>
                Browse plans in Discover.
              </span>
            </span>
            <ChevronRight size={20} style={{ color: W.disabled }} aria-hidden />
          </Link>
        ) : null}

        <div className="grid grid-cols-3 gap-2" aria-label="This week">
          <Tile value={week ? String(week.workouts) : "–"} label={week?.workouts === 1 ? "workout this week" : "workouts this week"} />
          <Tile value={week ? fmtLiftTime(week.minutes) : "–"} label="time lifting" />
          <Tile value={week ? String(week.prs) : "–"} label={week?.prs === 1 ? "new PR" : "new PRs"} />
        </div>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-extrabold">My workouts</h2>
            {workouts && workouts.length > 0 && (
              <span className="text-[13px]" style={{ color: W.stone }}>
                Tap a name to edit
              </span>
            )}
          </div>
          {workouts && workouts.length > 0 && (
            <div className="overflow-hidden rounded-[20px] bg-white">
              {workouts.map((wk, i) => (
                <SavedRow
                  key={wk.id}
                  workout={wk}
                  lib={lib}
                  today={today}
                  timezone={timezone}
                  first={i === 0}
                  disabled={busy}
                  onEdit={() => editWorkout(wk)}
                  onStart={() => run(() => start.startSaved(wk))}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={startBuild}
            className="flex items-center gap-3.5 rounded-[20px] px-4 py-3.5 text-left"
            style={{ border: `2px dashed ${W.lilac}`, background: W.tintRow }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: W.purple }} aria-hidden>
              <Plus size={22} />
            </span>
            <span>
              <span className="block text-[16px] font-extrabold">Build a workout</span>
              <span className="block text-[13px]" style={{ color: W.stone }}>
                Pick exercises by muscle and save it.
              </span>
            </span>
          </button>
          {workouts && workouts.length === 0 && (
            <p className="text-[13px]" style={{ color: W.stone }}>
              Build your go-to workouts once and start them in one tap.
            </p>
          )}
        </section>

        {overview && overview.recent.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[17px] font-extrabold">Recent</h2>
            <div className="overflow-hidden rounded-[20px] bg-white">
              {overview.recent.map((r, i) => {
                const d = recentDate(r.localDate);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setOpenSession(r)}
                    className="flex min-h-16 w-full items-center gap-3 py-3 pl-4 pr-3.5 text-left"
                    style={{ borderTop: i ? `1px solid ${W.divider}` : undefined }}
                  >
                    <span className="flex w-11 shrink-0 flex-col items-center">
                      <span className="text-[11px] font-bold tracking-[0.5px]" style={{ color: W.muted }}>
                        {d.weekday}
                      </span>
                      <span className="text-[18px] font-extrabold leading-tight">{d.day}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-bold">{r.title}</span>
                      <span className="block text-[13px]" style={{ color: W.stone }}>
                        {recentMeta(r)}
                      </span>
                    </span>
                    {r.prs > 0 && (
                      <span
                        className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] font-extrabold"
                        style={{ background: W.gold, color: W.goldText }}
                        aria-label={plural(r.prs, "personal best")}
                      >
                        <Trophy size={12} aria-hidden />
                        {r.prs}
                      </span>
                    )}
                    <ChevronRight size={20} className="shrink-0" style={{ color: W.disabled }} aria-hidden />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {lifts.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[17px] font-extrabold">Your lifts</h2>
              <span className="text-[13px]" style={{ color: W.stone }}>
                Best set · change in 30 days
              </span>
            </div>
            <div className="overflow-hidden rounded-[20px] bg-white">
              {shownLifts.map((l, i) => {
                const ex = lib.get(l.exerciseId)!;
                return (
                  <Link
                    key={l.exerciseId}
                    to="/exercises/$exerciseId"
                    params={{ exerciseId: l.exerciseId }}
                    className="flex min-h-16 items-center gap-3 py-2.5 pl-3 pr-3.5"
                    style={{ borderTop: i ? `1px solid ${W.divider}` : undefined }}
                  >
                    <ExerciseThumb name={ex.name} primary={ex.primary} image={ex.imageStart} size={44} radius={12} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{ex.name}</span>
                      {l.best && (
                        <span className="block text-[13px]" style={{ color: W.stone }}>
                          Best: {l.best}
                        </span>
                      )}
                    </span>
                    {l.change && (
                      <span className="shrink-0 text-[13px] font-extrabold" style={{ color: W.greenText }}>
                        {l.change}
                      </span>
                    )}
                    <ChevronRight size={20} className="shrink-0" style={{ color: W.disabled }} aria-hidden />
                  </Link>
                );
              })}
              {lifts.length > LIFTS_SHOWN && (
                <button
                  type="button"
                  onClick={() => setAllLifts((v) => !v)}
                  aria-expanded={allLifts}
                  className="h-12 w-full text-[14px] font-bold"
                  style={{ color: W.violet, borderTop: `1px solid ${W.divider}` }}
                >
                  {liftsToggleLabel(lifts.length, allLifts)}
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      <Drawer open={!!openSession} onOpenChange={(o) => !o && setOpenSession(null)} shouldScaleBackground={false}>
        <DrawerContent
          className="rounded-t-[24px] border-0 bg-white p-0 [&>div:first-child]:hidden"
          style={{ fontFamily: FONT, color: W.ink }}
        >
          {openSession && (
            <div className="flex flex-col gap-3 px-5 pt-2.5" style={{ paddingBottom: "max(34px, env(safe-area-inset-bottom))" }}>
              <span className="mx-auto h-[5px] w-10 rounded-full" style={{ background: W.line }} aria-hidden />
              <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: W.muted }}>
                {sessionKicker(openSession.localDate, openSession.minutes)}
              </span>
              <DrawerTitle className="text-[22px] font-extrabold leading-tight">{openSession.title}</DrawerTitle>
              <DrawerDescription className="sr-only">What you did in this workout</DrawerDescription>
              {openSession.items.length > 0 && (
                <div className="flex flex-col rounded-2xl px-3.5 py-3" style={{ background: "#F7F5F2" }}>
                  {openSession.items.map((it, i) => (
                    <div key={`${it.exerciseId}-${i}`} className="flex items-baseline justify-between gap-3 py-1 text-[15px]">
                      <span className="min-w-0 font-semibold">{it.name}</span>
                      <span className="shrink-0 text-right" style={{ color: W.stone }}>
                        {it.line}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={busy || !openSession.again.some((e) => lib.has(e.exerciseId))}
                onClick={() => doAgain(openSession)}
                className="h-[52px] rounded-[26px] text-[16px] font-bold text-white disabled:opacity-60"
                style={{ background: W.purple }}
              >
                Do this workout again
              </button>
              <button
                type="button"
                onClick={() => setOpenSession(null)}
                className="h-12 rounded-[24px] text-[16px] font-bold"
                style={{ border: `1.5px solid ${W.line}` }}
              >
                Close
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {active && (
        <PlanOptionsSheet
          open={optionsOpen}
          title={planWeekTitle(active)}
          rows={[
            { label: "See plan", onClick: () => navigate({ to: "/plans/$slug", params: { slug: active.slug } }) },
            { label: "Leave plan", danger: true, onClick: () => setLeaveOpen(true) },
          ]}
          onClose={() => setOptionsOpen(false)}
        />
      )}
      <LeavePlanSheet plan={active} open={leaveOpen} onClose={() => setLeaveOpen(false)} />
      {overlays}
    </div>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col rounded-2xl bg-white px-3 pb-2.5 pt-3">
      <span className="text-[20px] font-extrabold tabular-nums leading-tight">{value}</span>
      <span className="text-[12px] leading-snug" style={{ color: W.stone }}>
        {label}
      </span>
    </div>
  );
}
