import { NO_FILTERS, FILTER_KEYS, type PlanFilters } from "@/lib/plan-filters";

/** New-version Discover tabs shown in phase 4. Posts, Meals and People come later. */
export type DiscoverTab = "workouts" | "plans";

/** ?tab= value to a tab; anything else (missing, "crews", junk) opens Workouts. */
export function parseDiscoverTab(v: unknown): DiscoverTab {
  return v === "plans" ? "plans" : "workouts";
}

export type GoalChip = { key: string; label: string; filters: Partial<PlanFilters> };

/** Goal chips on the new Plans tab. "Home" = bodyweight or bands only (dumbbells is its own choice). */
export const NEW_GOAL_CHIPS: GoalChip[] = [
  { key: "all", label: "All", filters: {} },
  { key: "muscle", label: "Muscle", filters: { goal: ["muscle"] } },
  { key: "fat_loss", label: "Lose fat", filters: { goal: ["fat_loss"] } },
  { key: "glutes", label: "Glutes", filters: { goal: ["glutes"] } },
  { key: "home", label: "Home", filters: { equipment: ["none", "band"] } },
  { key: "strength", label: "Strength", filters: { goal: ["strength"] } },
  { key: "beginner", label: "Get moving", filters: { goal: ["beginner"] } },
  { key: "run", label: "Run", filters: { goal: ["run"] } },
  { key: "mobility", label: "Mobility", filters: { goal: ["mobility"] } },
];

export const chipFilters = (c: GoalChip): PlanFilters => ({ ...NO_FILTERS, ...c.filters });

/** The chip whose filters equal the current ones, or null when other filters are on. */
export function selectedChipKey(f: PlanFilters): string | null {
  const hit = NEW_GOAL_CHIPS.find((c) => {
    const cf = chipFilters(c);
    return FILTER_KEYS.every((k) => [...cf[k]].sort().join(",") === [...f[k]].sort().join(","));
  });
  return hit?.key ?? null;
}

/** Plan rows under the "YOUR PLAN" card never repeat the active plan. */
export function plansWithoutActive<T extends { slug: string }>(plans: T[], activeSlug: string | null): T[] {
  return activeSlug ? plans.filter((p) => p.slug !== activeSlug) : plans;
}

/** "Week 2 of 8 · 7 of 40 workouts done" */
export function activePlanProgressLine(p: { currentWeek: number; weeks: number; workoutsDone: number; daysPerWeek: number }): string {
  const total = p.weeks * p.daysPerWeek;
  const week = Math.min(Math.max(1, p.currentWeek), p.weeks);
  return `Week ${week} of ${p.weeks} · ${Math.min(p.workoutsDone, total)} of ${total} workouts done`;
}

export const crewmateOnPlanLine = (firstName: string, crewName: string) => `${firstName} from ${crewName} is on this`;
