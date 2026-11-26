import { useMemo, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { newToastApi as toast } from "./new-toast";
import { NewStatBox } from "./NewStatBox";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, CircleX, Minus, Moon, MoreHorizontal, Pause, Play, Share, Users, Zap,
} from "lucide-react";
import { coverThumb } from "@/lib/plan-filters";
import { dayForWeek, dayMinutes, scheduleForWeek, weekNoteFor, type Plan } from "@/lib/workout-plans";
import { leavePlan, startPlan, type MyActivePlan } from "@/lib/plans.functions";
import { getNewPlanInfo, getPlanRunProgress, inviteCrewToPlan, setPlanPaused, setPlanSchedule } from "@/lib/new-plan.functions";
import {
  WEEKDAY_LETTERS, WEEKDAY_NAMES, daysPickedLine, longDate, minutesTile, nextMondayIso, planSocialLine, repeatNote,
  thisWeekCells, todayCard, toggleDay, trainingDaysOrDefault, defaultTrainingDays, visibleWeekCount, weekRows,
} from "@/lib/new-plan-view";
import { localDateIn } from "@/lib/streak-rules";
import { getActiveWorkout } from "@/lib/active-workout";
import { useMyPlans, usePlans } from "@/components/plans/PlanBits";
import { PlanSharePanel } from "@/components/plans/PlanSharePanel";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { NewSheet, NewSheetButton, NewSheetCheckbox, NewSheetRow, NewSheetChevron } from "./NewSheet";
import { NewConfirm } from "./NewConfirm";
import { NewAvatarFallback } from "./NewAvatarFallback";

const INK = "#1C1917";
const G700 = "#44403C";
const G600 = "#57534E";
const MUTED = "#78716C";
const PURPLE = "#7C3AED";
const PURPLE_TEXT = "#6D28D9";
const PAGE = "#F5F2EC";
const FONT = "Inter, system-ui, sans-serif";

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const todayLocal = () => localDateIn(tz());

export function NewPlanPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePlans();
  const { data: mine } = useMyPlans();
  const plan = (plans ?? []).find((p) => p.slug === slug) ?? null;
  const active = mine?.active ?? null;
  if (!plan) {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-8 text-center" style={{ background: PAGE, fontFamily: FONT }}>
        {!isLoading && (
          <div>
            <div className="text-[17px] font-bold">This plan isn't available</div>
            <button type="button" onClick={() => navigate({ to: "/groups", search: { tab: "plans" } })} className="mt-3 h-11 rounded-full bg-white px-5 text-[15px] font-semibold" style={{ color: PURPLE_TEXT }}>
              See all plans
            </button>
          </div>
        )}
      </div>
    );
  }
  return active && active.planId === plan.id ? <PlanProgress plan={plan} active={active} /> : <PlanOverview plan={plan} otherActive={active} />;
}

function useBack() {
  const router = useRouter();
  const navigate = useNavigate();
  return () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/groups", search: { tab: "plans" } });
  };
}

function CircleButton({ label, onClick, children, tone }: { label: string; onClick: () => void; children: React.ReactNode; tone?: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: tone ?? "rgba(255,255,255,.82)", color: INK, backdropFilter: tone ? undefined : "blur(8px)" }}>
      {children}
    </button>
  );
}

function usePlanInfo(planId: string) {
  return useQuery({ queryKey: ["new-plan-info", planId], queryFn: () => getNewPlanInfo({ data: { planId } }), staleTime: 60_000 });
}

/* ------------------------------ A) not on plan ----------------------------- */

function PlanOverview({ plan, otherActive }: { plan: Plan; otherActive: MyActivePlan | null }) {
  const back = useBack();
  const navigate = useNavigate();
  const { data: info } = usePlanInfo(plan.id);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const social = planSocialLine(info?.mate ?? null, info?.count);
  const week1 = scheduleForWeek(plan, 1);
  const lighter = plan.weekNotes.filter((n) => n.lighter).map((n) => n.week);
  const note = plan.note ?? repeatNote(plan.weeks, lighter);
  const gear = plan.gear.length ? plan.gear : ["No equipment"];

  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-none" data-scroll-root style={{ background: PAGE, fontFamily: FONT, color: INK }}>
      <div className="relative h-[280px] overflow-hidden" style={{ background: "#ECE8E1" }}>
        {plan.coverUrl ? (
          <img src={plan.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center" style={{ background: "#FEF3C7" }}><Zap size={56} style={{ color: "#92400E" }} aria-hidden /></span>
        )}
        <div className="absolute left-4 right-4 flex justify-between" style={{ top: "calc(max(env(safe-area-inset-top), 44px) + 12px)" }}>
          <CircleButton label="Back" onClick={back}><ChevronLeft size={24} /></CircleButton>
          <CircleButton label="Share plan" onClick={() => setShareOpen(true)}><Share size={20} /></CircleButton>
        </div>
      </div>

      <section className="flex flex-col gap-3 bg-white px-5 pb-5 pt-5">
        <span className="text-[12px] font-extrabold uppercase tracking-[0.5px]" style={{ color: PURPLE }}>Pactara plan · {plan.level}</span>
        <h1 className="-mt-2 text-[24px] font-extrabold leading-tight tracking-[-0.4px]">{plan.name}</h1>
        <div className="grid grid-cols-3 gap-2">
          <NewStatBox value={String(plan.weeks)} label="weeks" />
          <NewStatBox value={String(plan.daysPerWeek)} label="days a week" />
          <NewStatBox value={minutesTile(plan.minutes)} label="min a day" />
        </div>
        <p className="text-[15px] leading-[1.45]" style={{ color: "#292524" }}>{plan.summary}</p>
        <div className="flex flex-wrap gap-1.5">
          {gear.map((g) => (
            <span key={g} className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: "#F0EDE8", color: G700 }}>{g}</span>
          ))}
        </div>
        {social && (
          <div className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5" style={{ background: "#F3EEFF" }} data-plan-social>
            {social.bold ? (
              <span className="block h-7 w-7 shrink-0 overflow-hidden rounded-full" style={{ background: "#E4DAFB" }}>
                {info?.mate?.avatarUrl ? <img src={info.mate.avatarUrl} alt="" className="h-full w-full object-cover" /> : <NewAvatarFallback />}
              </span>
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "#E4DAFB", color: PURPLE_TEXT }}><Users size={16} aria-hidden /></span>
            )}
            <span className="text-[14px] leading-snug" style={{ color: "#3B0764" }}>
              {social.bold && <strong className="font-bold">{social.bold}</strong>}
              {social.rest}
            </span>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2.5 px-4 pt-5" style={{ paddingBottom: "calc(130px + var(--workout-bar-pad, 0px))" }}>
        <span className="mx-1 text-[12px] font-extrabold uppercase tracking-[0.5px]" style={{ color: MUTED }}>Week 1</span>
        <DayList plan={plan} week={1} days={week1} onOpen={(d) => navigate({ to: "/plans/$slug/day", params: { slug: plan.slug }, search: { week: 1, day: d } })} />
        {note && <p className="mx-3 text-center text-[13px] leading-snug" style={{ color: MUTED }}>{note}</p>}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-white px-4 pt-3" style={{ borderTop: "1px solid #ECE8E1", bottom: "var(--workout-bar-pad, 0px)", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <button
          type="button"
          onClick={() => (otherActive ? setConfirmSwitch(true) : setSheetOpen(true))}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[17px] font-bold text-white"
          style={{ background: PURPLE }}
        >
          <Play size={18} fill="currentColor" aria-hidden /> Start plan
        </button>
      </div>

      <PlanSharePanel open={shareOpen} plan={plan} onClose={() => setShareOpen(false)} variant="new" />
      <NewConfirm
        open={confirmSwitch}
        onOpenChange={setConfirmSwitch}
        tone="primary"
        title={`Switch to ${plan.name}?`}
        subtitle={otherActive ? `You're on ${otherActive.name} (week ${otherActive.currentWeek}). Starting this plan switches you over. Your progress there is saved.` : ""}
        action="Switch plan"
        busy={false}
        error={null}
        onConfirm={() => { setConfirmSwitch(false); setSheetOpen(true); }}
      />
      <StartSheet open={sheetOpen} onOpenChange={setSheetOpen} plan={plan} crew={info?.crew ?? null} />
    </div>
  );
}

function DayList({ plan, week, days, onOpen }: { plan: Plan; week: number; days: ReturnType<typeof scheduleForWeek>; onOpen: (day: number) => void }) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-white">
      {days.map((d, i) => (
        <button
          key={`${week}-${d.dayNumber}`}
          type="button"
          onClick={() => onOpen(d.dayNumber)}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
          style={{ borderTop: i ? "1px solid #F0EDE9" : undefined }}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-extrabold" style={{ background: "#F0EDE8", color: G700 }}>D{d.dayNumber}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold">{d.title}</span>
            <span className="block text-[13px]" style={{ color: MUTED }}>{d.moves.length} {d.moves.length === 1 ? "exercise" : "exercises"} · {dayMinutes(d, plan)} min</span>
          </span>
          <ChevronRight size={20} className="shrink-0" style={{ color: "#A8A29E" }} aria-hidden />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ B) start sheet ----------------------------- */

function DaysPicker({ days, setDays, perWeek }: { days: number[]; setDays: (d: number[]) => void; perWeek: number }) {
  const line = daysPickedLine(days.length, perWeek);
  return (
    <>
      <div className="mt-2 flex justify-between">
        {WEEKDAY_LETTERS.map((l, i) => {
          const on = days.includes(i);
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              aria-label={WEEKDAY_NAMES[i]}
              onClick={() => setDays(toggleDay(days, i))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-bold"
              style={on ? { background: PURPLE, color: "#FFFFFF" } : { background: "#F0EDE8", color: INK }}
            >
              {l}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] leading-snug" style={{ color: line.ok ? MUTED : "#B45309", fontWeight: line.ok ? 400 : 600 }} data-days-line>{line.text}</p>
    </>
  );
}

function StartSheet({ open, onOpenChange, plan, crew }: {
  open: boolean; onOpenChange: (o: boolean) => void; plan: Plan;
  crew: { id: string; name: string; invitees: string[]; alreadyOn: string[] } | null;
}) {
  const qc = useQueryClient();
  const start = useServerFn(startPlan);
  const schedule = useServerFn(setPlanSchedule);
  const invite = useServerFn(inviteCrewToPlan);
  const today = todayLocal();
  const monday = nextMondayIso(today);
  const [when, setWhen] = useState<"today" | "monday">("today");
  const [days, setDays] = useState(() => defaultTrainingDays(plan.daysPerWeek));
  const [inviteOn, setInviteOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const ok = daysPickedLine(days.length, plan.daysPerWeek).ok;
  const showInvite = !!crew && crew.invitees.length > 0;

  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const { userPlanId } = await start({ data: { planId: plan.id } });
      await schedule({ data: { userPlanId, trainingDays: days, startsOn: when === "today" ? today : monday } });
      if (showInvite && inviteOn && crew) {
        try { await invite({ data: { planId: plan.id, groupId: crew.id } }); } catch { toast.error("Couldn't send the invite."); }
      }
      await qc.invalidateQueries({ queryKey: ["my-plans"] });
      void qc.invalidateQueries({ queryKey: ["plan-run"] });
      void qc.invalidateQueries({ queryKey: ["crew-plans"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the plan. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <NewSheet open={open} onOpenChange={onOpenChange} large title={`Start ${plan.name}`} subtitle="You can change any of this later.">
      <div data-start-sheet>
        <h3 className="mt-2 text-[15px] font-bold">When do you want to start?</h3>
        <div className="mt-2 flex gap-2">
          <WhenPill on={when === "today"} onClick={() => setWhen("today")}>Today</WhenPill>
          <WhenPill on={when === "monday"} onClick={() => setWhen("monday")}>{longDate(monday)}</WhenPill>
        </div>
        <h3 className="mt-5 text-[15px] font-bold">Which days will you train?</h3>
        <DaysPicker days={days} setDays={setDays} perWeek={plan.daysPerWeek} />
        {showInvite && crew && (
          <button
            type="button"
            onClick={() => setInviteOn((v) => !v)}
            aria-pressed={inviteOn}
            className="mt-5 flex w-full items-start gap-3 rounded-[14px] p-3 text-left"
            style={{ background: "#F3EEFF", border: `1.5px solid ${PURPLE}` }}
          >
            <NewSheetCheckbox checked={inviteOn} />
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">Invite {crew.name} to do it with me</span>
              <span className="mt-0.5 block text-[13px]" style={{ color: G600 }}>
                {joinNames(crew.invitees)} {crew.invitees.length === 1 ? "gets" : "get"} an invite.
                {crew.alreadyOn.length ? ` ${joinNames(crew.alreadyOn)} ${crew.alreadyOn.length === 1 ? "is" : "are"} already on it.` : ""}
              </span>
            </span>
          </button>
        )}
        <NewSheetButton disabled={!ok || busy} onClick={() => void go()}>{busy ? "One moment…" : "Start plan"}</NewSheetButton>
      </div>
    </NewSheet>
  );
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? names[0] ?? "" : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

function WhenPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="h-10 rounded-full px-4 text-[14px] font-semibold" style={on ? { background: PURPLE, color: "#FFFFFF" } : { background: "#FFFFFF", color: INK, border: "1px solid #E7E3DE" }}>
      {children}
    </button>
  );
}

/* ----------------------------- C) plan progress ---------------------------- */

function PlanProgress({ plan, active }: { plan: Plan; active: MyActivePlan }) {
  const back = useBack();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const starter = useStartWorkout();
  const pause = useServerFn(setPlanPaused);
  const schedule = useServerFn(setPlanSchedule);
  const leave = useServerFn(leavePlan);
  const { data: run } = useQuery({ queryKey: ["plan-run", active.id], queryFn: () => getPlanRunProgress({ data: { userPlanId: active.id } }), staleTime: 30_000 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [daysOpen, setDaysOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [allWeeks, setAllWeeks] = useState(false);
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftDays, setDraftDays] = useState<number[]>([]);

  const today = todayLocal();
  const trainingDays = trainingDaysOrDefault(run?.trainingDays, plan.daysPerWeek);
  const paused = !!run?.pausedAt;
  const doneDates = useMemo(() => (run?.logs ?? []).map((l) => localDateIn(tz(), new Date(l.completedAt))), [run]);
  const doneByWeek = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of run?.logs ?? []) m.set(l.week, (m.get(l.week) ?? 0) + 1);
    return m;
  }, [run]);
  const total = plan.weeks * plan.daysPerWeek;
  const nextDay = dayForWeek(plan, active.nextDay, active.currentWeek);
  const card = todayCard({ today, trainingDays, doneDates, startsOn: run?.startsOn, paused });
  const cells = thisWeekCells({ today, trainingDays, doneDates, startsOn: run?.startsOn, paused });
  const rows = weekRows({
    weeks: plan.weeks, currentWeek: active.currentWeek, perWeek: plan.daysPerWeek, doneByWeek, today,
    futureNote: (w) => weekNoteFor(plan, w)?.title ?? null,
  });
  const shownRows = allWeeks ? rows : rows.slice(0, visibleWeekCount(active.currentWeek, plan.weeks));
  const thumb = coverThumb(plan.coverUrl);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["plan-run", active.id] }), qc.invalidateQueries({ queryKey: ["my-plans"] })]);
  const startWorkout = async () => {
    if (busy) return;
    if (getActiveWorkout()) { navigate({ to: "/workout/log" }); return; }
    setBusy(true);
    try { await starter.startPlan(plan, active, { week: active.currentWeek, day: active.nextDay }); } finally { setBusy(false); }
  };
  const togglePause = async () => {
    setMenuOpen(false);
    try { await pause({ data: { userPlanId: active.id, paused: !paused } }); await refresh(); }
    catch { toast.error("Couldn't update the plan. Try again."); }
  };
  const saveDays = async () => {
    try { await schedule({ data: { userPlanId: active.id, trainingDays: draftDays } }); await refresh(); setDaysOpen(false); }
    catch { toast.error("Couldn't save your days. Try again."); }
  };
  const endPlan = async () => {
    setBusy(true);
    try {
      await leave({ data: { userPlanId: active.id } });
      await qc.invalidateQueries({ queryKey: ["my-plans"] });
      void qc.invalidateQueries({ queryKey: ["crew-plans"] });
      setEndOpen(false);
      toast.success(`You ended ${plan.name}`);
    } catch {
      toast.error("Couldn't end the plan. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-none" data-scroll-root style={{ background: PAGE, fontFamily: FONT, color: INK }}>
      <div className="flex flex-col gap-3 bg-white px-4 pb-5 pt-new-top">
        <header className="grid grid-cols-[44px_1fr_44px] items-center">
          <CircleButton label="Back" onClick={back} tone="#F0EDE8"><ChevronLeft size={24} /></CircleButton>
          <h1 className="truncate px-2 text-center text-[17px] font-bold">{plan.name}</h1>
          <CircleButton label="Plan options" onClick={() => setMenuOpen(true)} tone="#F0EDE8"><MoreHorizontal size={22} /></CircleButton>
        </header>

        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[22px] font-extrabold tracking-[-0.3px]">Week {active.currentWeek} of {plan.weeks}</span>
          <span className="text-[14px]" style={{ color: MUTED }}>{active.workoutsDone} of {total} workouts</span>
        </div>
        <span className="block h-1.5 overflow-hidden rounded-full" style={{ background: "#E7E3DE" }} role="progressbar" aria-label="Plan progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={active.workoutsDone}>
          <span className="block h-full rounded-full" style={{ background: PURPLE, width: `${Math.min(100, (active.workoutsDone / Math.max(1, total)) * 100)}%` }} />
        </span>
      </div>
      <div className="flex flex-col gap-3 px-4 pt-[6px]" style={{ paddingBottom: "calc(max(32px, env(safe-area-inset-bottom)) + var(--workout-bar-pad, 0px))" }}>

        <Label>Today</Label>
        <div className="flex flex-col gap-3 rounded-[18px] bg-white p-3.5" data-today-card>
          <button
            type="button"
            onClick={() => navigate({ to: "/plans/$slug/day", params: { slug: plan.slug }, search: { week: active.currentWeek, day: active.nextDay } })}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-[12px]" style={{ background: "#ECE8E1" }}>
              {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
              {card.kind === "workout" ? (
                <>
                  <span className="block text-[12px] font-extrabold uppercase tracking-[0.5px]" style={{ color: PURPLE }}>Week {active.currentWeek} · Day {active.nextDay}</span>
                  <span className="block truncate text-[18px] font-extrabold">{nextDay?.title ?? "Workout"}</span>
                  {nextDay && <span className="block text-[13px]" style={{ color: MUTED }}>{nextDay.moves.length} exercises · {dayMinutes(nextDay, plan)} min</span>}
                </>
              ) : card.kind === "paused" ? (
                <>
                  <span className="block text-[18px] font-extrabold">Paused. Your place is saved.</span>
                  <span className="block text-[13px]" style={{ color: MUTED }}>Next: Week {active.currentWeek} · Day {active.nextDay}{nextDay ? ` · ${nextDay.title}` : ""}</span>
                </>
              ) : (
                <>
                  <span className="block text-[18px] font-extrabold">{card.doneToday ? "Done for today" : "Rest day"}</span>
                  <span className="block text-[13px]" style={{ color: MUTED }}>Next: {card.nextWeekday ?? "Week " + active.currentWeek}{nextDay ? ` · ${nextDay.title}` : ""}</span>
                </>
              )}
            </span>
          </button>
          {card.kind === "workout" && (
            <>
              <button type="button" disabled={busy} onClick={() => void startWorkout()} className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold text-white disabled:opacity-60" style={{ background: PURPLE }}>
                <Play size={16} fill="currentColor" aria-hidden /> Start workout
              </button>
              {run?.crewName && <p className="-mt-1 text-center text-[12px]" style={{ color: MUTED }}>When you finish, checking in to {run.crewName} takes 5 seconds.</p>}
            </>
          )}
          {card.kind === "paused" && (
            <button type="button" onClick={() => void togglePause()} className="h-[52px] w-full rounded-full text-[17px] font-bold text-white" style={{ background: PURPLE }}>Resume plan</button>
          )}
        </div>

        <Label>This week</Label>
        <div className="grid grid-cols-7 rounded-[18px] bg-white px-1.5 py-3" data-this-week>
          {cells.map((c) => (
            <div key={c.date} className="flex flex-col items-center gap-1.5">
              <span className="text-[12px]" style={{ color: MUTED }}>{c.letter}</span>
              <WeekCellDot state={c.state} letter={c.letter} />
            </div>
          ))}
        </div>

        <Label>All weeks</Label>
        <div className="overflow-hidden rounded-[18px] bg-white">
          {shownRows.map((r, i) => (
            <div key={r.week} style={{ borderTop: i ? "1px solid #F0EDE9" : undefined }}>
              <button type="button" onClick={() => setOpenWeek(openWeek === r.week ? null : r.week)} aria-expanded={openWeek === r.week} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={r.status === "done" ? { background: "#DCFCE7", color: "#15803D" } : { boxShadow: `inset 0 0 0 2px ${r.status === "current" ? PURPLE : "#E7E3DE"}` }}
                >
                  {r.status === "done" && <Check size={16} strokeWidth={3} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold">Week {r.week}</span>
                  <span className="block truncate text-[13px]" style={{ color: MUTED }}>{r.sub}</span>
                </span>
                <span className="shrink-0 text-[13px] font-bold" style={{ color: r.status === "done" ? "#15803D" : r.status === "current" ? PURPLE : MUTED }}>{r.right}</span>
              </button>
              {openWeek === r.week && (
                <div className="px-2 pb-2">
                  <DayList plan={plan} week={r.week} days={scheduleForWeek(plan, r.week)} onOpen={(d) => navigate({ to: "/plans/$slug/day", params: { slug: plan.slug }, search: { week: r.week, day: d } })} />
                </div>
              )}
            </div>
          ))}
          {!allWeeks && shownRows.length < rows.length && (
            <button type="button" onClick={() => setAllWeeks(true)} className="block w-full px-3.5 py-3.5 text-left text-[14px] font-bold" style={{ color: PURPLE, borderTop: "1px solid #F0EDE9" }}>
              Show weeks {shownRows.length + 1} to {plan.weeks}
            </button>
          )}
        </div>
      </div>

      <NewSheet open={menuOpen} onOpenChange={setMenuOpen} title={plan.name} hideTitle>
        <div data-plan-menu>
          <NewSheetRow simple className={MENU_ROW} leading={<CalendarDays />} title="Change training days" trailing={<NewSheetChevron />} onClick={() => { setMenuOpen(false); setDraftDays(trainingDays); setDaysOpen(true); }} />
          <NewSheetRow simple className={MENU_ROW} leading={<Share />} title="Share plan" trailing={<NewSheetChevron />} onClick={() => { setMenuOpen(false); setShareOpen(true); }} />
          <NewSheetRow
            simple
            className={MENU_ROW}
            leading={paused ? <Play /> : <Pause />}
            title={paused ? "Resume plan" : "Pause plan"}
            trailing={paused ? undefined : <span className="text-[13px] font-normal" style={{ color: MUTED }}>Keeps your place</span>}
            onClick={() => void togglePause()}
          />
          <div className="h-px" style={{ background: "#F0EDE9" }} />
          <NewSheetRow simple destructive className={MENU_ROW} leading={<CircleX className="text-[var(--new-destructive)]" />} title="End plan" onClick={() => { setMenuOpen(false); setEndOpen(true); }} />
        </div>
      </NewSheet>

      <NewSheet open={daysOpen} onOpenChange={setDaysOpen} title="Which days will you train?" subtitle="You can change this any time.">
        <DaysPicker days={draftDays} setDays={setDraftDays} perWeek={plan.daysPerWeek} />
        <NewSheetButton disabled={!daysPickedLine(draftDays.length, plan.daysPerWeek).ok} onClick={() => void saveDays()}>Save days</NewSheetButton>
      </NewSheet>

      <NewConfirm
        open={endOpen}
        onOpenChange={setEndOpen}
        title={`End ${plan.name}?`}
        subtitle={`You're on week ${active.currentWeek} of ${plan.weeks}. Your finished workouts stay in your history. To take a break instead, pause the plan.`}
        action="End plan"
        cancelLabel="Keep going"
        busy={busy}
        error={null}
        onConfirm={() => void endPlan()}
      />
      <PlanSharePanel open={shareOpen} plan={plan} onClose={() => setShareOpen(false)} variant="new" />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mx-1 mt-3 text-[12px] font-extrabold uppercase tracking-[0.5px]" style={{ color: MUTED }}>{children}</span>;
}

function WeekCellDot({ state, letter }: { state: ReturnType<typeof thisWeekCells>[number]["state"]; letter: string }) {
  const base = "flex h-10 w-10 items-center justify-center rounded-full";
  if (state === "done") return <span className={base} style={{ background: "#DCFCE7", color: "#15803D" }} aria-label="Done"><Check size={18} strokeWidth={3} /></span>;
  if (state === "today") return <span className={base} style={{ background: PURPLE, color: "#FFFFFF" }} aria-label="Today's workout"><HorizontalDumbbell /></span>;
  if (state === "before") return <span className={`${base} text-[15px] font-bold`} style={{ background: "#F5F5F4", color: "#A8A29E" }} aria-label="Before your start date">{letter}</span>;
  if (state === "rest") return <span className={base} style={{ background: "#EDE9FE", color: PURPLE }} aria-label="Rest day"><Moon size={17} /></span>;
  if (state === "missed") return <span className={base} style={{ background: "#F0EDE8", color: "#A8A29E" }} aria-label="Missed"><Minus size={18} strokeWidth={3} /></span>;
  return <span className={`${base} text-[15px] font-bold`} style={{ background: "#F0EDE8", color: INK }} aria-label="Training day">{letter}</span>;
}

/** Menu rows: 56px, 22px icons, 16px/600 labels, no dividers (only the one above End plan). */
const MENU_ROW = "!h-14 border-b-0 py-0";

function HorizontalDumbbell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 12h8" />
      <rect x="4.5" y="7" width="3.5" height="10" rx="1" />
      <rect x="16" y="7" width="3.5" height="10" rx="1" />
      <path d="M2.5 10v4M21.5 10v4" />
    </svg>
  );
}
