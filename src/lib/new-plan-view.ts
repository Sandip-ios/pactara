/**
 * New-version plan page rules (start sheet days, this-week cells, week rows,
 * people count, today card). Pure; dates are member-local YYYY-MM-DD strings.
 * Weekday indexes: 0 = Monday … 6 = Sunday (matches user_plans.training_days).
 */
import { addDaysIso, weekStartIso } from "./streak-rules";

export const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PRESETS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Mon-first preselection for a plan's days a week (5 = M-F, 4 = M T Th F, 3 = M W F). */
export function defaultTrainingDays(daysPerWeek: number): number[] {
  return [...(PRESETS[Math.min(7, Math.max(1, Math.round(daysPerWeek)))] ?? PRESETS[3]!)];
}

/** Saved days, or the preset when none were picked (older runs, classic starts). */
export function trainingDaysOrDefault(saved: number[] | null | undefined, daysPerWeek: number): number[] {
  return saved && saved.length ? [...new Set(saved)].sort((a, b) => a - b) : defaultTrainingDays(daysPerWeek);
}

export function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

/** The line under the day circles. A count that doesn't match blocks Start plan. */
export function daysPickedLine(picked: number, perWeek: number): { ok: boolean; text: string } {
  if (picked === perWeek) {
    return { ok: true, text: `${picked} ${picked === 1 ? "day" : "days"} picked. Your other days are rest days and keep your streak going.` };
  }
  return { ok: false, text: `This plan has ${perWeek} ${perWeek === 1 ? "workout" : "workouts"} a week. Pick ${perWeek}.` };
}

/** Monday after today (a week out when today is a Monday). */
export function nextMondayIso(today: string): string {
  return addDaysIso(weekStartIso(today), 7);
}

export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7;
}

export const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m! - 1]} ${d}`;
};
export const longDate = (iso: string) => `${WEEKDAY_NAMES[weekdayIndex(iso)]}, ${shortDate(iso)}`;

export type WeekCell = "done" | "today" | "upcoming" | "rest" | "missed" | "before";

/**
 * This calendar week (Mon-Sun). Done = a plan workout logged that day; rest =
 * not a training day; before = ahead of the start date (no state yet); today = training day not yet
 * done (unless paused); missed = a past training day with nothing logged.
 */
export function thisWeekCells(input: {
  today: string;
  trainingDays: number[];
  doneDates: Iterable<string>;
  startsOn?: string | null;
  paused?: boolean;
}): { date: string; letter: string; state: WeekCell }[] {
  const done = new Set(input.doneDates);
  const monday = weekStartIso(input.today);
  return WEEKDAY_LETTERS.map((letter, i) => {
    const date = addDaysIso(monday, i);
    let state: WeekCell;
    if (done.has(date)) state = "done";
    else if (input.startsOn && date < input.startsOn) state = "before";
    else if (!input.trainingDays.includes(i)) state = "rest";
    else if (date === input.today) state = input.paused ? "upcoming" : "today";
    else if (date < input.today) state = "missed";
    else state = "upcoming";
    return { date, letter, state };
  });
}

export type WeekRow = { week: number; status: "done" | "current" | "future"; sub: string; right: string };

export function weekRows(input: {
  weeks: number;
  currentWeek: number;
  perWeek: number;
  doneByWeek: Map<number, number>;
  today: string;
  futureNote: (week: number) => string | null;
}): WeekRow[] {
  const monday = weekStartIso(input.today);
  return Array.from({ length: input.weeks }, (_, i) => {
    const week = i + 1;
    const n = Math.min(input.perWeek, input.doneByWeek.get(week) ?? 0);
    const count = `${n} of ${input.perWeek} workouts`;
    if (week < input.currentWeek) return { week, status: "done", sub: count, right: "Done" };
    if (week === input.currentWeek) return { week, status: "current", sub: count, right: "In progress" };
    return {
      week,
      status: "future",
      sub: input.futureNote(week) ?? "Same days, a little heavier",
      right: `Starts ${shortDate(addDaysIso(monday, (week - input.currentWeek) * 7))}`,
    };
  });
}

/** Weeks shown before "Show weeks N to M": up to the week after the current one. */
export const visibleWeekCount = (currentWeek: number, weeks: number) => Math.min(weeks, currentWeek + 1);

/** The people count only reads as social proof from 10 up. */
export const PLAN_COUNT_MIN = 10;
export const showPlanCount = (count: number | null | undefined) => (count ?? 0) >= PLAN_COUNT_MIN;

export function planSocialLine(
  mate: { firstName: string; crewName: string; currentWeek: number } | null,
  count: number | null | undefined,
): { bold: string | null; rest: string } | null {
  const countPart = showPlanCount(count) ? `${count!.toLocaleString("en-US")} people are doing this plan.` : "";
  if (mate) return { bold: `${mate.firstName} from ${mate.crewName}`, rest: ` is on week ${mate.currentWeek}.${countPart ? ` ${countPart}` : ""}` };
  return countPart ? { bold: null, rest: countPart } : null;
}

export type TodayCard =
  | { kind: "paused" }
  | { kind: "workout" }
  | { kind: "rest"; doneToday: boolean; nextWeekday: string | null };

/** What the progress page's Today card shows. */
export function todayCard(input: {
  today: string;
  trainingDays: number[];
  doneDates: Iterable<string>;
  startsOn?: string | null;
  paused?: boolean;
}): TodayCard {
  if (input.paused) return { kind: "paused" };
  const done = new Set(input.doneDates);
  const started = !input.startsOn || input.today >= input.startsOn;
  const idx = weekdayIndex(input.today);
  if (started && input.trainingDays.includes(idx) && !done.has(input.today)) return { kind: "workout" };
  let next: string | null = null;
  for (let i = 1; i <= 7; i++) {
    const date = addDaysIso(input.today, i);
    if (input.trainingDays.includes(weekdayIndex(date)) && (!input.startsOn || date >= input.startsOn)) {
      next = WEEKDAY_NAMES[weekdayIndex(date)]!;
      break;
    }
  }
  return { kind: "rest", doneToday: done.has(input.today), nextWeekday: next };
}

/** "Weeks 2 to 8 repeat these days, a little harder each week. Weeks 4 and 8 are lighter so you recover." */
export function repeatNote(weeks: number, lighterWeeks: number[]): string | null {
  if (weeks < 2) return null;
  const first = `Weeks 2 to ${weeks} repeat these days, a little harder each week.`;
  if (!lighterWeeks.length) return first;
  const list = lighterWeeks.length === 1 ? `Week ${lighterWeeks[0]} is` : `Weeks ${lighterWeeks.slice(0, -1).join(", ")} and ${lighterWeeks.at(-1)} are`;
  return `${first} ${list} lighter so you recover.`;
}

/** "25-35" stays a range; "40" stays a number. */
export const minutesTile = (minutes: string) => minutes.replace(/\s*[–-]\s*/, "-");
