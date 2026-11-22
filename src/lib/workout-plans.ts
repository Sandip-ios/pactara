/**
 * Workout plans: pure rules shared by screens, server functions and tests.
 * Plan progress (week / next day) only ever moves forward when a plan day is
 * checked in; missing a calendar day never changes it.
 */

export type PlanGoal = "muscle" | "fat_loss" | "glutes" | "beginner" | "home" | "run";

export type PlanMove = { name: string; dose: string; plain: string };

export type PlanDay = {
  dayNumber: number;
  /** Set only for days that change week to week (the 5K runs). */
  weekNumber: number | null;
  title: string;
  minutes: string | null;
  note: string | null;
  moves: PlanMove[];
};

export type Plan = {
  id: string;
  slug: string;
  name: string;
  goal: PlanGoal;
  level: string;
  weeks: number;
  daysPerWeek: number;
  minutes: string;
  gear: string[];
  summary: string;
  progressionRule: string;
  safetyNote: string;
  note: string | null;
  days: PlanDay[];
};

export const GOAL_CHIPS: { goal: PlanGoal; label: string }[] = [
  { goal: "muscle", label: "Build muscle" },
  { goal: "fat_loss", label: "Lose fat" },
  { goal: "glutes", label: "Glutes" },
  { goal: "beginner", label: "Get moving again" },
  { goal: "home", label: "At home" },
  { goal: "run", label: "Run" },
];

export function goalLabel(goal: PlanGoal): string {
  return GOAL_CHIPS.find((g) => g.goal === goal)?.label ?? goal;
}

export const restDaysFor = (plan: Pick<Plan, "daysPerWeek">) => Math.max(0, 7 - plan.daysPerWeek);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Matches plan name, goal (label or id) and move names; optional goal chip filter. */
export function searchPlans<T extends Pick<Plan, "name" | "goal" | "days">>(
  plans: T[],
  query: string,
  goal: PlanGoal | null = null,
): T[] {
  const q = norm(query);
  return plans.filter((p) => {
    if (goal && p.goal !== goal) return false;
    if (!q) return true;
    const haystack = [
      p.name,
      p.goal.replace("_", " "),
      goalLabel(p.goal),
      ...p.days.flatMap((d) => d.moves.map((m) => m.name)),
    ].map(norm);
    return haystack.some((h) => h.includes(q));
  });
}

export type PlanPosition = { week: number; day: number };

/**
 * After finishing `pos`: the next day, wrapping to Day 1 of the next week
 * after the last day; finishing the last day of the last week completes it.
 */
export function advancePlan(
  pos: PlanPosition,
  shape: { weeks: number; daysPerWeek: number },
): PlanPosition & { completed: boolean } {
  if (pos.day < shape.daysPerWeek) return { week: pos.week, day: pos.day + 1, completed: false };
  if (pos.week < shape.weeks) return { week: pos.week + 1, day: 1, completed: false };
  return { week: pos.week, day: pos.day, completed: true };
}

/** The day to do for a given week: a week-specific row wins over the every-week row. */
export function dayForWeek(plan: Pick<Plan, "days">, dayNumber: number, week: number): PlanDay | null {
  return (
    plan.days.find((d) => d.dayNumber === dayNumber && d.weekNumber === week) ??
    plan.days.find((d) => d.dayNumber === dayNumber && d.weekNumber === null) ??
    null
  );
}

/** Days shown for one week of the schedule, Day 1 first. */
export function scheduleForWeek(plan: Pick<Plan, "days" | "daysPerWeek">, week: number): PlanDay[] {
  const out: PlanDay[] = [];
  for (let d = 1; d <= plan.daysPerWeek; d++) {
    const day = dayForWeek(plan, d, week);
    if (day) out.push(day);
  }
  return out;
}

export const hasWeeklyVariation = (plan: Pick<Plan, "days">) => plan.days.some((d) => d.weekNumber !== null);

export function dayMinutes(day: PlanDay, plan: Pick<Plan, "minutes">): string {
  return day.minutes ?? plan.minutes;
}

/** Run days are tagged Run on check-in; everything else is a Workout. */
export function checkInActivityFor(day: Pick<PlanDay, "moves">): "run" | "workout" {
  return day.moves.some((m) => /\brun\b|\b5k\b/i.test(m.name)) ? "run" : "workout";
}

/** "Build Muscle · Week 3, Day 2" for the plan chip on a feed post. */
export function planChipLabel(name: string, week: number, day: number): string {
  return `${name} · Week ${week}, Day ${day}`;
}

export type UserPlanRow = { id: string; planId: string; status: "active" | "completed" | "stopped" };

/**
 * What starting `planId` does to someone's plans (one active plan at a time):
 * - already on it → nothing changes;
 * - any other active plan is stopped (its progress is kept);
 * - a stopped run of this plan resumes where it left off, otherwise a new run starts.
 */
export function planStartAction(rows: UserPlanRow[], planId: string): {
  alreadyActiveId: string | null;
  stopIds: string[];
  resumeId: string | null;
} {
  const active = rows.filter((r) => r.status === "active");
  const same = active.find((r) => r.planId === planId);
  if (same) return { alreadyActiveId: same.id, stopIds: active.filter((r) => r.id !== same.id).map((r) => r.id), resumeId: null };
  const resume = rows.find((r) => r.planId === planId && r.status === "stopped") ?? null;
  return { alreadyActiveId: null, stopIds: active.map((r) => r.id), resumeId: resume?.id ?? null };
}

/** A gentle next step once a plan is finished. */
const NEXT_PLAN: Record<string, string> = {
  "walk-strength": "home-no-equipment",
  "home-no-equipment": "lose-fat",
  "lose-fat": "build-muscle",
  "glute-builder": "build-muscle",
  "build-muscle": "glute-builder",
  "first-5k": "lose-fat",
};

export function suggestNextPlan(slug: string): string | null {
  return NEXT_PLAN[slug] ?? null;
}

/** What posting a plan-day check-in did to the plan. */
export type PlanDayResult = {
  slug: string;
  planName: string;
  completed: boolean;
  nextWeek: number;
  nextDay: number;
};
