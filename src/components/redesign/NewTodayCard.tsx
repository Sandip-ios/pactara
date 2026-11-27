import { useEffect, useRef, useState } from "react";
import { setTodayResumeVisible } from "@/lib/today-resume";
import { ArrowRight, Check, ChevronDown, ChevronRight, ChevronUp, Dumbbell, Moon, Snowflake, Users } from "lucide-react";
import type { TodayCrewInput, TodayPlanInput, TodaySelection } from "@/lib/home-today";
import { coverThumb } from "@/lib/plan-filters";

const PURPLE = "#7C3AED";
const LIGHT_PURPLE = "#EDE4FF";
const GREEN = "#15803D";
const MUTED = "#57534E";
const CHEVRON = "#8A847E";

export function NewTodayCard({
  selection,
  crews,
  plan,
  onRetry,
  onOpenCrew,
  onCheckIn,
  onCheckInAnyway,
  onStartCrew,
  onStartPlan,
  onResumePlan,
}: {
  selection: TodaySelection;
  crews: TodayCrewInput[];
  plan: TodayPlanInput | null;
  onRetry: () => void;
  onOpenCrew: (id: string) => void;
  onCheckIn: (ids: string[]) => void;
  onCheckInAnyway: (ids: string[]) => void;
  onStartCrew: () => void;
  onStartPlan: () => Promise<void>;
  onResumePlan: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const resumeShown = selection.card === "ready" && selection.plan === "in-progress" && !!plan;
  useEffect(() => {
    const el = sectionRef.current;
    if (!resumeShown || !el) { setTodayResumeVisible(false); return; }
    const io = new IntersectionObserver(([e]) => setTodayResumeVisible(!!e?.isIntersecting));
    io.observe(el);
    return () => { io.disconnect(); setTodayResumeVisible(false); };
  }, [resumeShown]);

  if (selection.card === "loading") return <TodayLoading />;
  if (selection.card === "error") {
    return (
      <section aria-label="Today" className="mx-3 mt-3 flex items-center gap-3 rounded-[20px] bg-[var(--new-white)] p-[18px]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold">Couldn't load today</h2>
          <p className="mt-1 text-[12px] text-[var(--new-muted)]">Check your connection and try again.</p>
        </div>
        <button type="button" onClick={onRetry} className="h-10 shrink-0 rounded-full border border-[#D6D3D1] px-4 text-[14px] font-bold">Try again</button>
      </section>
    );
  }

  if (selection.crew === "empty") {
    return (
      <section aria-label="Today" className="mx-3 mt-3 rounded-[20px] bg-[var(--new-white)] px-3.5 py-1.5">
        <div className="flex items-center justify-between gap-2 py-4">
          <span className="text-[17px] font-extrabold">Start or join a crew</span>
          <button type="button" className="h-10 rounded-full bg-[var(--new-soft)] px-4 text-[14px] font-bold text-[var(--new-purple-text)]" onClick={onStartCrew}>Start</button>
        </div>
      </section>
    );
  }

  const single = crews.length === 1;
  const first = crews[0]!;
  const multiple = !single;
  const expandable = multiple;
  const lightCheckIn = selection.plan === "in-progress";
  const planDoneLine = selection.plan === "checked-in" && selection.checkedInCrewIds.length > 0;
  const showCrewList = expandable && open;

  const startPlan = async () => {
    if (starting) return;
    setStarting(true);
    try { await onStartPlan(); } finally { setStarting(false); }
  };

  const checkInButton = (small = false) => (
    <button
      type="button"
      onClick={() => onCheckIn(single ? [first.id] : selection.crew === "multi-not-checked" ? crews.map((crew) => crew.id) : selection.missingCrewIds)}
      className={`${small ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-[14px]"} shrink-0 rounded-full font-bold`}
      style={{ background: lightCheckIn ? LIGHT_PURPLE : PURPLE, color: lightCheckIn ? PURPLE : "#FFFFFF" }}
    >
      Check in
    </button>
  );

  let crewPart: React.ReactNode;
  if (selection.crew === "single-not-checked" || selection.crew === "multi-not-checked") {
    crewPart = (
      <div className="flex min-h-[76px] items-center gap-3 p-3.5">
        <button type="button" onClick={() => expandable && setOpen((value) => !value)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={expandable ? open : undefined}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--new-soft)] text-[var(--new-purple)]"><Users size={21} /></span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-[14px] font-bold leading-[1.25]">
              <span>{single ? `${first.name} · ${first.checkedInCount} of ${first.dueCount} checked in` : `Your ${crews.length} crews`}</span>
              {expandable && (open ? <ChevronUp size={16} color={CHEVRON} /> : <ChevronDown size={16} color={CHEVRON} />)}
            </span>
            <span className="mt-0.5 block text-[12px] text-[var(--new-muted)]">Not checked in yet</span>
          </span>
        </button>
        {checkInButton()}
      </div>
    );
  } else {
    let line = "";
    if (planDoneLine) line = "Checked in today · plan done";
    else if (selection.crew === "single-checked") line = `Checked in today · ${first.name} ${first.checkedInCount} of ${first.dueCount}`;
    else if (selection.crew === "multi-partial") line = `Checked in to ${selection.checkedInCrewIds.length} of ${crews.length} crews`;
    else if (selection.crew === "multi-all-checked") line = `Checked in today · all ${crews.length} crews`;
    else line = selection.cover === "freeze" ? "Freeze used · no check-in needed" : "Rest day · no check-in needed";

    const icon = selection.cover && (selection.crew === "single-covered" || selection.crew === "multi-covered")
      ? selection.cover === "freeze" ? <Snowflake size={18} color="#0369A1" /> : <Moon size={18} color="#0369A1" />
      : <Check size={17} strokeWidth={3} color={GREEN} />;
    const iconBackground = selection.cover && (selection.crew === "single-covered" || selection.crew === "multi-covered") ? "#E0F2FE" : "#DCFCE7";
    const opensCrew = single;
    const pill = selection.crew === "multi-partial" && selection.missingCrewIds.length > 0;
    crewPart = (
      <div className="flex min-h-[60px] items-center gap-2 px-3.5 py-3">
        <button
          type="button"
          onClick={() => opensCrew ? onOpenCrew(first.id) : setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-expanded={expandable ? open : undefined}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: iconBackground }}>{icon}</span>
          <span className="min-w-0 flex-1 text-[14px] font-semibold leading-[1.3]">{line}</span>
          {!pill && expandable && (open ? <ChevronUp size={16} color={CHEVRON} /> : <ChevronDown size={16} color={CHEVRON} />)}
          {single && <ChevronRight size={16} color={CHEVRON} />}
        </button>
        {pill && checkInButton(true)}
        {pill && (
          <button type="button" aria-label={open ? "Hide crews" : "Show crews"} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="-mr-1 flex h-8 w-7 shrink-0 items-center justify-center">
            {open ? <ChevronUp size={16} color={CHEVRON} /> : <ChevronDown size={16} color={CHEVRON} />}
          </button>
        )}
      </div>
    );
  }

  return (
    <section ref={sectionRef} aria-label="Today" className="mx-3 mt-3 rounded-[20px] bg-[var(--new-white)]">
      {crewPart}
      {showCrewList && (
        <div className="px-3 pb-3">
        <div className="rounded-[14px] bg-[#F7F5F2] px-3">
          <ul>
            {crews.map((crew) => {
              const missing = selection.crew === "multi-partial" && selection.missingCrewIds.includes(crew.id);
              return (
                <li key={crew.id} className="border-b border-[#EAE6E1] last:border-0">
                  <button type="button" onClick={() => onOpenCrew(crew.id)} className="flex min-h-11 w-full items-center gap-2 py-2 text-left">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{crew.name}</span>
                    <span className={`shrink-0 text-[12px] ${missing ? "font-semibold" : ""}`} style={{ color: missing ? "#C2410C" : MUTED }}>
                      {missing ? "Not checked in yet" : `${crew.checkedInCount} of ${crew.dueCount} checked in`}
                    </span>
                    <ChevronRight size={16} color={CHEVRON} className="shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
          {(selection.crew === "multi-covered") && (
            <div className="flex items-center justify-between gap-2 px-0.5 pt-3">
              <span className="min-w-0 flex-1 text-[12px] text-[var(--new-muted)]">People resting today aren't counted.</span>
              <button type="button" onClick={() => onCheckInAnyway(crews.map((crew) => crew.id))} className="h-8 shrink-0 rounded-full bg-[#EDE4FF] px-3 text-[12px] font-bold text-[#7C3AED]">Check in anyway</button>
            </div>
          )}
        </div>
      )}
      {selection.plan !== "none" && selection.plan !== "checked-in" && plan && (
        <div className="mx-3.5 flex min-h-[74px] items-center gap-3 border-t border-[#F0EDE9] py-3">
          {coverThumb(plan.coverUrl) ? (
            <span className="h-11 w-11 shrink-0 overflow-hidden rounded-[12px] bg-[#EDE4FF]">
              <img src={coverThumb(plan.coverUrl)!} alt="" className="h-full w-full object-cover" />
            </span>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#EDE4FF]"><Dumbbell size={20} color="#7C3AED" /></span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold">{plan.name}</p>
            {selection.plan === "in-progress" ? (
              <p className="mt-0.5 text-[12px] font-semibold text-[#15803D]">● In progress · {plan.elapsedMinutes} min</p>
            ) : (
              <p className="mt-0.5 truncate text-[12px] text-[var(--new-muted)]">Week {plan.week}, day {plan.day} · {plan.title} · {plan.minutes} min</p>
            )}
          </div>
          {selection.plan === "in-progress" ? (
            <button type="button" onClick={onResumePlan} className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#7C3AED] px-3 text-[13px] font-bold text-white"><ArrowRight size={15} />Resume</button>
          ) : selection.plan === "done" ? (
            <span className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#DCFCE7] px-3 text-[13px] font-bold text-[#15803D]"><Check size={14} strokeWidth={3} />Done</span>
          ) : (
            <button type="button" disabled={starting} onClick={() => void startPlan()} className="h-9 shrink-0 rounded-full bg-[#EDE4FF] px-4 text-[13px] font-bold text-[#7C3AED] disabled:opacity-60">Start</button>
          )}
        </div>
      )}
    </section>
  );
}

function TodayLoading() {
  return (
    <section aria-label="Loading today" className="mx-3 mt-3 rounded-[20px] bg-[var(--new-white)] p-3.5" aria-hidden>
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-full bg-[#EFEAE4]" />
        <div className="flex-1"><div className="h-4 w-3/5 animate-pulse rounded bg-[#EFEAE4]" /><div className="mt-2 h-3 w-2/5 animate-pulse rounded bg-[#EFEAE4]" /></div>
        <div className="h-10 w-20 animate-pulse rounded-full bg-[#EFEAE4]" />
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-[#F0EDE9] pt-3">
        <div className="h-12 w-12 animate-pulse rounded-[12px] bg-[#EFEAE4]" />
        <div className="flex-1"><div className="h-4 w-2/5 animate-pulse rounded bg-[#EFEAE4]" /><div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-[#EFEAE4]" /></div>
      </div>
    </section>
  );
}
