/**
 * Discover → All plans: filter chips, goal tiles and their counts (pure).
 * Filters combine with AND across chips and OR within a chip.
 */
import { EQUIPMENT_LABEL, GOAL_CHIPS, type EquipmentKey, type Plan, type PlanGoal } from "@/lib/workout-plans";

export type FilterKey = "days" | "minutes" | "equipment" | "level" | "goal";
export type PlanFilters = Record<FilterKey, string[]>;
export type FilterOption = { value: string; label: string };
export type FilterDef = { key: FilterKey; chip: string; title: string; helper: string; options: FilterOption[] };

export const FILTER_KEYS: FilterKey[] = ["days", "minutes", "equipment", "level", "goal"];
export const NO_FILTERS: PlanFilters = { days: [], minutes: [], equipment: [], level: [], goal: [] };

export const FILTER_DEFS: Record<FilterKey, FilterDef> = {
  days: {
    key: "days",
    chip: "Days a week",
    title: "How many days a week?",
    helper: "Pick one or more.",
    options: [3, 4, 5].map((n) => ({ value: String(n), label: `${n} days` })),
  },
  minutes: {
    key: "minutes",
    chip: "Minutes",
    title: "How long per workout?",
    helper: "Pick one or more.",
    options: [
      { value: "15-20", label: "15–20 min" },
      { value: "25-30", label: "25–30 min" },
      { value: "40-45", label: "40–45 min" },
      { value: "50+", label: "50+ min" },
    ],
  },
  equipment: {
    key: "equipment",
    chip: "Equipment",
    title: "What do you have?",
    helper: "Pick everything you can use. Plans that need more are hidden.",
    options: (Object.keys(EQUIPMENT_LABEL) as EquipmentKey[]).map((k) => ({ value: k, label: EQUIPMENT_LABEL[k] })),
  },
  level: {
    key: "level",
    chip: "Level",
    title: "What's your level?",
    helper: "Pick one or more.",
    options: [
      { value: "total-beginner", label: "Total beginner" },
      { value: "beginner", label: "Beginner" },
      { value: "intermediate", label: "Intermediate" },
    ],
  },
  goal: {
    key: "goal",
    chip: "Goal",
    title: "What's your goal?",
    helper: "Pick one or more.",
    options: GOAL_CHIPS.map((g) => ({ value: g.goal, label: g.label })),
  },
};

export type FilterablePlan = Pick<Plan, "daysPerWeek" | "minutes" | "equipmentKey" | "level" | "goal">;

/** Minutes bucket by the lower number: "30–60" → 25-30, "20–35" → 15-20, "50" → 50+. */
export function minutesBucket(minutes: string): string | null {
  const m = minutes.match(/\d+/);
  if (!m) return null;
  const lo = Number(m[0]);
  if (lo <= 20) return "15-20";
  if (lo <= 34) return "25-30";
  if (lo <= 49) return "40-45";
  return "50+";
}

/** Level options a plan's level counts for: "Beginner–intermediate" → both; "All levels" → every option. */
export function levelTags(level: string): string[] {
  const l = level.toLowerCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();
  if (l === "all levels") return ["total-beginner", "beginner", "intermediate"];
  if (l === "total beginner") return ["total-beginner"];
  if (l === "beginner intermediate") return ["beginner", "intermediate"];
  if (l === "beginner") return ["beginner"];
  if (l === "intermediate") return ["intermediate"];
  return [];
}

export function matchesOption(p: FilterablePlan, key: FilterKey, value: string): boolean {
  switch (key) {
    case "days":
      return String(p.daysPerWeek) === value;
    case "minutes":
      return minutesBucket(p.minutes) === value;
    case "equipment":
      return p.equipmentKey === value;
    case "level":
      return levelTags(p.level).includes(value);
    case "goal":
      return p.goal === value;
  }
}

/** AND across chips, OR within a chip; `skip` leaves one chip out (for that chip's own option counts). */
export function planMatches(p: FilterablePlan, filters: PlanFilters, skip?: FilterKey): boolean {
  return FILTER_KEYS.every((k) => k === skip || filters[k].length === 0 || filters[k].some((v) => matchesOption(p, k, v)));
}

export function filterPlans<T extends FilterablePlan>(plans: T[], filters: PlanFilters): T[] {
  return plans.filter((p) => planMatches(p, filters));
}

/** Plans an option would show, alongside the other chips' filters. */
export function optionCount(plans: FilterablePlan[], filters: PlanFilters, key: FilterKey, value: string): number {
  return plans.filter((p) => planMatches(p, filters, key) && matchesOption(p, key, value)).length;
}

/** "Show N plans" while ticking in a sheet: the other chips plus this chip's draft. */
export function draftCount(plans: FilterablePlan[], filters: PlanFilters, key: FilterKey, draft: string[]): number {
  return filterPlans(plans, { ...filters, [key]: draft }).length;
}

export const showPlansLabel = (n: number) => (n === 0 ? "No plans match" : `Show ${n} ${n === 1 ? "plan" : "plans"}`);
export const plansCountLabel = (n: number) => `${n} ${n === 1 ? "plan" : "plans"}`;

/** Active chip text: the one value ("3 days", "No equipment") or "2 options"; null when off. */
export function chipValue(key: FilterKey, values: string[]): string | null {
  if (values.length === 0) return null;
  if (values.length > 1) return `${values.length} options`;
  return FILTER_DEFS[key].options.find((o) => o.value === values[0])?.label ?? null;
}

export const activeFilterCount = (f: PlanFilters) => FILTER_KEYS.filter((k) => f[k].length > 0).length;

/** Keep only known option values, in option order (URL input). */
export function cleanFilter(key: FilterKey, values: string[]): string[] {
  return FILTER_DEFS[key].options.map((o) => o.value).filter((v) => values.includes(v));
}

// ---------- Browse by goal ----------

export type GoalTileKey = PlanGoal | "home";
export type GoalTile = { key: GoalTileKey; label: string; filters: Partial<PlanFilters> };

/** 8 tiles; "At home" is every no-equipment plan, any goal. */
export const GOAL_TILES: GoalTile[] = [
  ...GOAL_CHIPS.filter((g) => g.goal !== "mobility").map((g) => ({ key: g.goal, label: g.label, filters: { goal: [g.goal] } })),
  { key: "home", label: "At home", filters: { equipment: ["none"] } },
  { key: "mobility", label: "Mobility + core", filters: { goal: ["mobility"] } },
];

export const tileFilters = (t: GoalTile): PlanFilters => ({ ...NO_FILTERS, ...t.filters });
export const tileCount = (plans: FilterablePlan[], t: GoalTile) => filterPlans(plans, tileFilters(t)).length;
export const tileIsOn = (f: PlanFilters, t: GoalTile) =>
  FILTER_KEYS.every((k) => (tileFilters(t)[k].join(",") === f[k].join(",")));

/** The member's active plan first, then catalog order. */
export function sortForDiscover<T extends { slug: string }>(plans: T[], activeSlug: string | null): T[] {
  if (!activeSlug) return plans;
  const mine = plans.filter((p) => p.slug === activeSlug);
  return [...mine, ...plans.filter((p) => p.slug !== activeSlug)];
}

/**
 * The note under results when the Days a week filter is on and one of the
 * member's crews asks for more check-ins than the smallest ticked day count.
 */
export function crewDaysNote(daysTicked: string[], crewWeeklyTargets: number[]): string | null {
  if (daysTicked.length === 0 || crewWeeklyTargets.length === 0) return null;
  const days = Math.min(...daysTicked.map(Number));
  const crew = Math.max(...crewWeeklyTargets);
  if (!(crew > days)) return null;
  const diff = crew - days;
  const rest = diff === 1 ? "The other 1 day is your choice" : `The other ${diff} days are your choice`;
  return `Your crew checks in ${crew} days a week? A ${days}-day plan still works. ${rest}: a walk, a run or any workout.`;
}

/** Small square cover for plan cards (Unsplash covers are stored at 1200px). */
export function coverThumb(url: string | null, px = 252): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== "images.unsplash.com") return url;
    u.searchParams.set("w", String(px));
    u.searchParams.set("h", String(px));
    u.searchParams.set("fit", "crop");
    return u.toString();
  } catch {
    return url;
  }
}
