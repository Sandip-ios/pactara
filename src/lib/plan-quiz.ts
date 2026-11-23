/**
 * "Find your plan" quiz: answer options, deterministic plan matching and the
 * wording on the results screen (pure, published plans in sort_order).
 */
import { NO_FILTERS, filterPlans, type FilterablePlan, type PlanFilters } from "@/lib/plan-filters";
import { EQUIPMENT_LABEL, goalLabel, type EquipmentKey, type Plan, type PlanGoal } from "@/lib/workout-plans";

export type Experience = "new" | "some" | "regular";
export type QuizDays = 3 | 4 | 5;
export type QuizAnswers = { goal: PlanGoal; experience: Experience; equipment: EquipmentKey[]; days: number };
export type QuizPlan = Pick<Plan, "slug" | "goal" | "level" | "daysPerWeek" | "equipmentKey" | "gearShort">;

export const QUIZ_STEPS = 4;

export const QUIZ_GOALS: { goal: PlanGoal; emoji: string; label: string; hint: string }[] = [
  { goal: "muscle", emoji: "💪", label: "Build muscle", hint: "Look and feel stronger" },
  { goal: "fat_loss", emoji: "🔥", label: "Lose fat", hint: "Keep your muscle" },
  { goal: "glutes", emoji: "🦵", label: "Glutes", hint: "Stronger glutes" },
  { goal: "strength", emoji: "🏋️", label: "Get stronger", hint: "Lift more" },
  { goal: "beginner", emoji: "🚶", label: "Get moving again", hint: "Easy start" },
  { goal: "run", emoji: "🏃", label: "Run", hint: "Your first 5K or 10K" },
  { goal: "mobility", emoji: "🧘", label: "Mobility + core", hint: "Loosen up, steadier back" },
];

export const EXPERIENCE_OPTIONS: { value: Experience; emoji: string; label: string; hint: string }[] = [
  { value: "new", emoji: "🌱", label: "I'm new", hint: "Or it has been a long time" },
  { value: "some", emoji: "🔁", label: "On and off", hint: "I know some moves" },
  { value: "regular", emoji: "⚡", label: "I train regularly", hint: "Most weeks for 6+ months" },
];

export const EQUIPMENT_OPTIONS: { value: EquipmentKey; emoji: string; label: string; hint: string }[] = [
  { value: "none", emoji: "🙌", label: "No equipment", hint: "Just your body" },
  { value: "dumbbells", emoji: "🏋️", label: "Dumbbells", hint: "Any weight" },
  { value: "band", emoji: "🎗️", label: "Mini band", hint: "A loop band" },
  { value: "kettlebell", emoji: "🔔", label: "Kettlebell", hint: "Just one is fine" },
  { value: "gym", emoji: "🏢", label: "Gym", hint: "Machines + barbells" },
  { value: "shoes", emoji: "👟", label: "Running shoes", hint: "For the run plans" },
];

export const QUIZ_DAY_OPTIONS: QuizDays[] = [3, 4, 5];

const isGoal = (v: unknown): v is PlanGoal => QUIZ_GOALS.some((g) => g.goal === v);
const isExperience = (v: unknown): v is Experience => EXPERIENCE_OPTIONS.some((o) => o.value === v);

/** URL values back to answers; unknown values are dropped. */
export function parseQuizGoal(v: unknown): PlanGoal | undefined {
  return isGoal(v) ? v : undefined;
}
export function parseExperience(v: unknown): Experience | undefined {
  return isExperience(v) ? v : undefined;
}
export function parseEquipment(v: unknown): EquipmentKey[] {
  const list = typeof v === "string" ? v.split(",") : [];
  return EQUIPMENT_OPTIONS.map((o) => o.value).filter((k) => list.includes(k));
}
export function parseQuizDays(v: unknown): QuizDays | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return n === 3 || n === 4 || n === 5 ? n : undefined;
}

/** Everything the member can use: "No equipment" always; a gym also has dumbbells, bands and kettlebells. */
export function usableEquipment(picked: EquipmentKey[]): Set<EquipmentKey> {
  const out = new Set<EquipmentKey>(["none", ...picked]);
  if (picked.includes("gym")) for (const k of ["dumbbells", "band", "kettlebell"] as const) out.add(k);
  return out;
}

const levelKey = (level: string) => level.toLowerCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();

const LEVEL_FIT: Record<Experience, string[]> = {
  new: ["total beginner", "beginner", "all levels"],
  some: ["beginner", "beginner intermediate", "all levels"],
  regular: ["beginner intermediate", "intermediate", "all levels"],
};

export const levelFits = (level: string, exp: Experience) => LEVEL_FIT[exp].includes(levelKey(level));

/** Goal match +100, equipment fits +50, level fits +25, same days +10 (else -2 per day of difference). */
export function scorePlan(p: QuizPlan, a: QuizAnswers): number {
  let s = 0;
  if (p.goal === a.goal) s += 100;
  if (usableEquipment(a.equipment).has(p.equipmentKey)) s += 50;
  if (levelFits(p.level, a.experience)) s += 25;
  s += p.daysPerWeek === a.days ? 10 : -2 * Math.abs(p.daysPerWeek - a.days);
  return s;
}

const GOAL_INSTEAD: Record<PlanGoal, string> = {
  muscle: "building muscle",
  fat_loss: "losing fat",
  glutes: "glutes",
  strength: "getting stronger",
  beginner: "getting moving again",
  run: "running",
  mobility: "mobility and core",
};

const LEVEL_FOR: Record<string, string> = {
  "total beginner": "total beginners",
  beginner: "beginners",
  "beginner intermediate": "beginner to intermediate",
  intermediate: "people who train regularly",
};

function levelPill(level: string, exp: Experience): string {
  const l = levelKey(level);
  if (l === "all levels") return "Good for all levels";
  if (l === "total beginner" || l === "beginner") return "Good for beginners";
  if (l === "intermediate" || exp === "regular") return "Good if you train regularly";
  return "Good if you know some moves";
}

function needsLine(p: QuizPlan): string {
  if (p.slug === "lose-fat") return "Needs light dumbbells or water bottles";
  const gear = p.gearShort?.trim() || EQUIPMENT_LABEL[p.equipmentKey];
  if (gear.toLowerCase() === "gym") return "Needs a gym";
  return `Needs ${gear.toLowerCase()}`;
}

/** What matches, in order: goal, equipment, level, days. */
export function whyPills(p: QuizPlan, a: QuizAnswers, crewDays: number | null): string[] {
  const out: string[] = [];
  if (p.goal === a.goal) out.push(goalLabel(p.goal));
  if (usableEquipment(a.equipment).has(p.equipmentKey)) {
    out.push(EQUIPMENT_LABEL[p.equipmentKey]);
  }
  if (levelFits(p.level, a.experience)) out.push(levelPill(p.level, a.experience));
  if (p.daysPerWeek === a.days) out.push(crewDays === a.days ? `${a.days} days, like your crew` : `${a.days} days a week`);
  return out;
}

/** The first mismatch, in order: goal, equipment, level, days; null when everything fits. */
export function differenceLine(p: QuizPlan, a: QuizAnswers): string | null {
  if (p.goal !== a.goal) return `Built for ${GOAL_INSTEAD[p.goal]} instead`;
  if (!usableEquipment(a.equipment).has(p.equipmentKey)) return needsLine(p);
  if (!levelFits(p.level, a.experience)) return `Made for ${LEVEL_FOR[levelKey(p.level)] ?? p.level.toLowerCase()}`;
  if (p.daysPerWeek !== a.days) return `${p.daysPerWeek} days a week instead of ${a.days}`;
  return null;
}

/** Under the best match when the plan has fewer days than the crew rule. */
export function crewDaysLine(planDays: number, crewDays: number | null): string | null {
  if (crewDays == null || planDays >= crewDays) return null;
  const n = crewDays - planDays;
  return n === 1 ? "Your other crew day: any walk, run or workout" : `Your other ${n} crew days: any walk, run or workout`;
}

export type QuizResult<T extends QuizPlan = QuizPlan> = {
  plan: T;
  score: number;
  why: string[];
  difference: string | null;
};

/**
 * Best match = highest score (ties: catalog order); then 2 alternatives,
 * same goal as the best match first, then by score and catalog order.
 * `plans` must be the published catalog in sort_order. Null only when empty.
 */
export function matchPlans<T extends QuizPlan>(
  plans: T[],
  a: QuizAnswers,
  crewDays: number | null,
): { best: QuizResult<T>; also: QuizResult<T>[]; crewLine: string | null } | null {
  const scored = plans.map((plan, order) => ({ plan, order, score: scorePlan(plan, a) }));
  if (scored.length === 0) return null;
  const ranked = [...scored].sort((x, y) => y.score - x.score || x.order - y.order);
  const top = ranked[0]!;
  const also = ranked
    .slice(1)
    .sort(
      (x, y) =>
        Number(y.plan.goal === top.plan.goal) - Number(x.plan.goal === top.plan.goal) ||
        y.score - x.score ||
        x.order - y.order,
    )
    .slice(0, 2);
  const result = (r: { plan: T; score: number }): QuizResult<T> => ({
    plan: r.plan,
    score: r.score,
    why: whyPills(r.plan, a, crewDays),
    difference: differenceLine(r.plan, a),
  });
  return { best: result(top), also: also.map(result), crewLine: crewDaysLine(top.plan.daysPerWeek, crewDays) };
}

/** Q4 preselect: the highest crew rule, kept within 3 to 5; nothing without a crew. */
export function presetDays(crewTargets: number[]): QuizDays | null {
  if (crewTargets.length === 0) return null;
  const n = Math.max(...crewTargets);
  return n >= 5 ? 5 : n <= 3 ? 3 : (n as QuizDays);
}

const LEVEL_FILTER: Record<Experience, string[]> = {
  new: ["total-beginner", "beginner"],
  some: ["beginner"],
  regular: ["intermediate"],
};

/** "Browse all plans with my answers": Goal, Equipment (as picked), Level (from Q2) and Days. */
export function quizToFilters(a: QuizAnswers): PlanFilters {
  return {
    ...NO_FILTERS,
    goal: [a.goal],
    equipment: [...a.equipment],
    level: LEVEL_FILTER[a.experience],
    days: [String(a.days)],
  };
}

/**
 * The filters "Browse all plans with my answers" applies: all four when they
 * show a plan, else drop Days, then Level, then Equipment until one shows.
 * Goal always stays (every quiz goal has published plans).
 */
export function browseFilters(plans: FilterablePlan[], a: QuizAnswers): PlanFilters {
  let f = quizToFilters(a);
  for (const drop of ["days", "level", "equipment"] as const) {
    if (filterPlans(plans, f).length > 0) return f;
    f = { ...f, [drop]: [] };
  }
  return f;
}
