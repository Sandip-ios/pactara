/**
 * Pure helpers for Home's crew bar, Today card and "Crew today" row.
 * Every date is a local calendar date ("YYYY-MM-DD") in that member's own
 * timezone; week math comes from streak-rules (Mon → Sun weeks).
 */
import { addDaysIso, weekStartIso, weeklyTarget, type GroupSchedule } from "@/lib/streak-rules";

export type CrewTodayStatus = "done" | "working_out" | "rest" | "not_yet";
export type CrewDayState = "checked" | "rest" | "missed" | "none";

export type MemberDayInputs = {
  /** The member's own local today. */
  today: string;
  /** Days with a check-in in this group. */
  checkIns: Set<string>;
  /** Days covered by a rest or streak-freeze row in this group. */
  covered: Set<string>;
  /** Days the hourly job marked missed in this group. */
  missed: Set<string>;
  /** A live (not yet expired) workout session is running in this group. */
  workingOut: boolean;
};

/** Today's state: checked in beats a live workout, which beats a rest/freeze row. */
export function crewTodayStatus(i: MemberDayInputs): CrewTodayStatus {
  if (i.checkIns.has(i.today)) return "done";
  if (i.workingOut) return "working_out";
  if (i.covered.has(i.today)) return "rest";
  return "not_yet";
}

/** Monday → Sunday of the member's own week: checked, rest/freeze, missed or nothing. */
export function crewWeekDays(i: MemberDayInputs): { date: string; state: CrewDayState }[] {
  const start = weekStartIso(i.today);
  return Array.from({ length: 7 }, (_, n) => {
    const date = addDaysIso(start, n);
    const state: CrewDayState = i.checkIns.has(date)
      ? "checked"
      : i.covered.has(date)
        ? "rest"
        : i.missed.has(date)
          ? "missed"
          : "none";
    return { date, state };
  });
}

/** Workouts (distinct check-in days) this week against the group's weekly target. */
export function crewMemberWeek(i: MemberDayInputs, group: GroupSchedule) {
  const days = crewWeekDays(i);
  const upToToday = days.filter((d) => d.date <= i.today);
  const workouts = upToToday.filter((d) => d.state === "checked").length;
  const restDays = upToToday.filter((d) => d.state === "rest").length;
  const missedDays = upToToday.filter((d) => d.state === "missed").length;
  return {
    workouts,
    target: weeklyTarget(group),
    restDays,
    missedDays,
    days,
    status: crewTodayStatus(i),
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Screen-reader label for the 7 week dots. */
export function weekDotsLabel(workouts: number, restDays: number, missedDays = 0): string {
  const base = `${plural(workouts, "workout", "workouts")} and ${plural(restDays, "rest day", "rest days")}`;
  return missedDays > 0 ? `${base} this week, ${missedDays} missed` : `${base} this week`;
}

const STATUS_ORDER: Record<CrewTodayStatus, number> = {
  not_yet: 0,
  working_out: 1,
  rest: 2,
  done: 3,
};

/** "You" first, then members who haven't checked in yet, then everyone else. */
export function orderCrew<T extends { isYou: boolean; status: CrewTodayStatus }>(members: T[]): T[] {
  return members
    .map((m, index) => ({ m, index }))
    .sort((a, b) => {
      if (a.m.isYou !== b.m.isYou) return a.m.isYou ? -1 : 1;
      const byStatus = STATUS_ORDER[a.m.status] - STATUS_ORDER[b.m.status];
      return byStatus || a.index - b.index;
    })
    .map(({ m }) => m);
}

const ACTIVITY_LABELS: Record<string, string> = {
  meal: "Meal",
  workout: "Workout",
  run: "Run",
  progress: "Progress",
  sleep: "Sleep",
  water: "Water",
  meditation: "Meditation",
};

/** Short label for a check-in's activity tag, or null when untagged. */
export function activityLabel(activity: string | null | undefined): string | null {
  const id = (activity ?? "").trim();
  if (!id) return null;
  return ACTIVITY_LABELS[id.toLowerCase()] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** Today card title. */
export function todayHeadline(input: {
  inCount: number;
  crewSize: number;
  solo: boolean;
  checkedIn: boolean;
}): string {
  if (input.checkedIn) return "You're in for today.";
  if (input.solo) return "Check in with proof and keep your streak alive.";
  if (input.inCount <= 0) return "Be the first one in today.";
  return `${input.inCount} of ${input.crewSize} are in. Don't be the one.`;
}

/** Today card footer suffix after "{workouts} of {target} this week". */
export function weekFooterNote(input: { workouts: number; target: number; restLeft: number }): {
  text: string;
  tone: "muted" | "green";
} {
  if (input.workouts > input.target) return { text: "Over goal", tone: "green" };
  if (input.workouts === input.target) return { text: "Goal hit", tone: "muted" };
  return { text: plural(input.restLeft, "rest day left", "rest days left"), tone: "muted" };
}

/** "Crew streak: 3 days" / "1 day" / "Start today" (solo: "Your streak: …"). */
export function streakChipLabel(streak: number, solo: boolean): string {
  const prefix = solo ? "Your streak" : "Crew streak";
  if (streak <= 0) return `${prefix}: Start today`;
  return `${prefix}: ${plural(streak, "day", "days")}`;
}
