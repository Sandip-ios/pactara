/**
 * Workout plans: pure rules shared by screens, server functions and tests.
 * Plan progress (week / next day) only ever moves forward when a plan day is
 * checked in; missing a calendar day never changes it.
 */

export type PlanGoal = "muscle" | "fat_loss" | "glutes" | "beginner" | "home" | "run";

/** An easier or harder option for a move ("Make it fit you"); `exercise_id` when it's a library exercise. */
export type MoveOption = { name: string; note?: string | null; exercise_id?: string | null };

/**
 * `exercise_id`: the matching exercise library entry, when there is a good match.
 * `mistakes`, `easier`, `harder`: our own How to copy; a How to section is hidden when it's missing.
 */
export type PlanMove = {
  name: string;
  dose: string;
  plain: string;
  exercise_id?: string | null;
  mistakes?: { mistake: string; fix: string }[] | null;
  easier?: MoveOption | null;
  harder?: MoveOption | null;
};

/** Body-map regions a day works: 2 = main focus, 1 = also worked. */
export const MUSCLE_REGIONS = [
  "chest",
  "shoulders",
  "traps",
  "back",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
] as const;
export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];
export type MuscleMap = Partial<Record<MuscleRegion, 0 | 1 | 2>>;

export type WeekNote = { week: number; emoji: string; title: string; note: string; lighter: boolean };

export type PlanDay = {
  dayNumber: number;
  /** Set only for days that change week to week (the 5K runs). */
  weekNumber: number | null;
  title: string;
  minutes: string | null;
  note: string | null;
  moves: PlanMove[];
  muscles: MuscleMap;
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
  coverUrl: string | null;
  coverCredit: string | null;
  focusLine: string | null;
  /** Short gear line for plan cards, e.g. "Dumbbells + bench". */
  gearShort: string | null;
  weekNotes: WeekNote[];
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

/** Matches plan name, goal (label or id), gear and move names; optional goal chip filter. */
export function searchPlans<T extends Pick<Plan, "name" | "goal" | "days"> & Partial<Pick<Plan, "gear" | "gearShort">>>(
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
      ...(p.gear ?? []),
      p.gear && p.gear.length === 0 ? "no equipment" : "",
      p.gearShort ?? "",
      ...p.days.flatMap((d) => d.moves.map((m) => m.name)),
    ]
      .map(norm)
      .filter(Boolean);
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

/** How many plans each goal tile leads to. */
export function plansPerGoal(plans: Pick<Plan, "goal">[]): Record<PlanGoal, number> {
  const out = { muscle: 0, fat_loss: 0, glutes: 0, beginner: 0, home: 0, run: 0 } as Record<PlanGoal, number>;
  for (const p of plans) out[p.goal] = (out[p.goal] ?? 0) + 1;
  return out;
}

/** Whole-plan body map: the strongest level each region reaches on any day. */
export function planMuscleMap(plan: Pick<Plan, "days">): MuscleMap {
  const out: MuscleMap = {};
  for (const d of plan.days) {
    for (const r of MUSCLE_REGIONS) {
      const v = d.muscles?.[r] ?? 0;
      if (v > (out[r] ?? 0)) out[r] = v;
    }
  }
  return out;
}

const REGION_LABEL: Record<MuscleRegion, string> = {
  chest: "chest",
  shoulders: "shoulders",
  traps: "upper back",
  back: "back",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  abs: "core",
  glutes: "glutes",
  quads: "quads",
  hamstrings: "hamstrings",
  calves: "calves",
};

const listWords = (xs: string[]) =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/** Screen-reader text for a body map: "Main muscles: chest, shoulders and triceps. Also worked: core." */
export function muscleMapLabel(map: MuscleMap): string {
  const main = MUSCLE_REGIONS.filter((r) => map[r] === 2).map((r) => REGION_LABEL[r]);
  const also = MUSCLE_REGIONS.filter((r) => map[r] === 1).map((r) => REGION_LABEL[r]);
  const parts = [];
  if (main.length) parts.push(`Main muscles: ${listWords(main)}.`);
  if (also.length) parts.push(`Also worked: ${listWords(also)}.`);
  return parts.join(" ") || "Body map";
}

export function weekNoteFor(plan: Pick<Plan, "weekNotes">, week: number): WeekNote | null {
  return plan.weekNotes.find((n) => n.week === week) ?? null;
}

/** Lighter (deload) week: 2 sets of everything, so 3x10 → 2x10 and "3 sets" → "2 sets". */
export function lighterDose(dose: string): string {
  return dose
    .replace(/^(\d+)\s*x/i, (m, n: string) => (Number(n) > 2 ? "2x" : m))
    .replace(/^(\d+) sets/i, (m, n: string) => (Number(n) > 2 ? "2 sets" : m));
}

export function movesForWeek(moves: PlanMove[], lighter: boolean): PlanMove[] {
  return lighter ? moves.map((m) => ({ ...m, dose: lighterDose(m.dose) })) : moves;
}

/** Muscle group for a move's thumbnail tile: CH/SH/BK/LG/AR/CO/GL. */
export type MoveGroup = "CH" | "SH" | "BK" | "LG" | "AR" | "CO" | "GL";
const MOVE_GROUP_RULES: [RegExp, MoveGroup][] = [
  [/hip thrust|glute|kickback|clamshell|frog pump|side walk|sumo/i, "GL"],
  [/curl|tricep|dip|close-grip/i, "AR"],
  [/shoulder press|lateral raise|rear-delt|pike|squat to press|thruster/i, "SH"],
  [/bench press|dumbbell press|push-up/i, "CH"],
  [/row|pullover|superman/i, "BK"],
  [/plank|dead bug|bird dog|mountain climber|bear crawl|stretch|farmer/i, "CO"],
];
export function moveGroup(name: string): MoveGroup {
  for (const [re, g] of MOVE_GROUP_RULES) if (re.test(name)) return g;
  return "LG";
}

export type CrewOnPlan = { firstName: string; status: "active" | "completed"; currentWeek: number };

/**
 * The crew line on a plan page, split so the names can be bold:
 * "Bertille and Michele" + " from your crew finished this plan."
 */
export function crewProofLine(people: CrewOnPlan[]): { bold: string; rest: string } | null {
  if (people.length === 0) return null;
  const done = people.filter((p) => p.status === "completed");
  const on = people.filter((p) => p.status === "active");
  if (people.length >= 3) {
    const verb = on.length === 0 ? "finished this plan" : done.length === 0 ? "are on this plan" : "are on or finished this plan";
    return { bold: `${people.length} people`, rest: ` from your crews ${verb}.` };
  }
  if (done.length === people.length) {
    return { bold: listWords(done.map((p) => p.firstName)), rest: " from your crew finished this plan." };
  }
  if (on.length === people.length) {
    if (on.length === 1) return { bold: on[0]!.firstName, rest: ` from your crew is on week ${on[0]!.currentWeek}.` };
    return { bold: listWords(on.map((p) => p.firstName)), rest: " from your crew are on this plan." };
  }
  const d = done[0]!;
  const o = on[0]!;
  return { bold: `${d.firstName} and ${o.firstName}`, rest: ` from your crew: ${d.firstName} finished it, ${o.firstName} is on week ${o.currentWeek}.` };
}
