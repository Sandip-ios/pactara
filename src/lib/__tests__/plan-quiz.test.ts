import { describe, expect, it } from "vitest";
import {
  browseFilters,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  QUIZ_GOALS,
  crewDaysLine,
  differenceLine,
  levelFits,
  matchPlans,
  presetDays,
  quizToFilters,
  scorePlan,
  usableEquipment,
  whyPills,
  type QuizAnswers,
  type QuizPlan,
} from "../plan-quiz";
import { filterPlans } from "../plan-filters";
import type { EquipmentKey, PlanGoal } from "../workout-plans";

// The published catalog in sort_order.
const ROWS: [string, PlanGoal, string, number, EquipmentKey, string][] = [
  ["walk-strength", "beginner", "Total beginner", 5, "none", "Chair + wall"],
  ["home-no-equipment", "beginner", "Beginner", 5, "none", "No equipment"],
  ["gym-first-steps", "beginner", "Total beginner", 3, "gym", "Gym"],
  ["lose-fat", "fat_loss", "Beginner", 5, "dumbbells", "Light dumbbells"],
  ["twenty-minute-burn", "fat_loss", "Beginner", 3, "none", "No equipment"],
  ["kettlebell-burn", "fat_loss", "Beginner", 3, "kettlebell", "One kettlebell"],
  ["build-muscle", "muscle", "Beginner", 5, "dumbbells", "Dumbbells + bench"],
  ["muscle-3-days", "muscle", "Beginner", 3, "dumbbells", "Dumbbells + bench"],
  ["gym-upper-lower", "muscle", "Intermediate", 4, "gym", "Gym"],
  ["glute-builder", "glutes", "Beginner–intermediate", 4, "dumbbells", "Dumbbells + band"],
  ["glutes-at-home", "glutes", "Beginner", 3, "band", "Mini band"],
  ["gym-glutes", "glutes", "Intermediate", 4, "gym", "Gym"],
  ["strength-foundations", "strength", "Beginner–intermediate", 3, "gym", "Barbell + rack"],
  ["bodyweight-strength", "strength", "Intermediate", 3, "none", "No equipment"],
  ["first-5k", "run", "Beginner", 5, "shoes", "Running shoes"],
  ["five-to-ten-k", "run", "Beginner–intermediate", 4, "shoes", "Running shoes"],
  ["daily-mobility", "mobility", "All levels", 5, "none", "No equipment"],
  ["core-strong", "mobility", "Beginner", 3, "none", "No equipment"],
];
const CATALOG = ROWS.map(([slug, goal, level, daysPerWeek, equipmentKey, gearShort]) => ({
  slug,
  goal,
  level,
  daysPerWeek,
  equipmentKey,
  gearShort,
  minutes: "30",
}));
const plan = (slug: string): QuizPlan => CATALOG.find((p) => p.slug === slug)!;

const loseFatNew: QuizAnswers = { goal: "fat_loss", experience: "new", equipment: ["none"], days: 5 };
const strongerGym: QuizAnswers = { goal: "strength", experience: "regular", equipment: ["gym"], days: 3 };

describe("find your plan: matching", () => {
  it("Lose fat + new + no equipment + 5 days → 20-Minute Burn, then Lose Fat and Kettlebell Burn", () => {
    const r = matchPlans(CATALOG, loseFatNew, null)!;
    expect(r.best.plan.slug).toBe("twenty-minute-burn");
    expect(r.also.map((x) => x.plan.slug)).toEqual(["lose-fat", "kettlebell-burn"]);
  });

  it("Get stronger + regularly + gym + 3 days → Strength Foundations (tie broken by catalog order)", () => {
    const r = matchPlans(CATALOG, strongerGym, null)!;
    expect(r.best.plan.slug).toBe("strength-foundations");
    expect(r.best.score).toBe(scorePlan(plan("bodyweight-strength"), strongerGym));
    expect(r.also[0]!.plan.slug).toBe("bodyweight-strength");
  });

  it("scores goal +100, equipment +50, level +25, same days +10, else -2 per day apart", () => {
    expect(scorePlan(plan("twenty-minute-burn"), loseFatNew)).toBe(100 + 50 + 25 - 4);
    expect(scorePlan(plan("lose-fat"), loseFatNew)).toBe(100 + 25 + 10);
    expect(scorePlan(plan("home-no-equipment"), loseFatNew)).toBe(50 + 25 + 10);
  });

  it("a gym also counts as dumbbells, band and kettlebell; no equipment always fits", () => {
    expect([...usableEquipment(["gym"])].sort()).toEqual(["band", "dumbbells", "gym", "kettlebell", "none"]);
    expect([...usableEquipment(["shoes"])].sort()).toEqual(["none", "shoes"]);
  });

  it("experience levels: new fits total beginner/beginner/all levels; regular fits beginner–intermediate/intermediate/all levels", () => {
    expect(levelFits("Total beginner", "new")).toBe(true);
    expect(levelFits("Beginner–intermediate", "new")).toBe(false);
    expect(levelFits("Beginner–intermediate", "some")).toBe(true);
    expect(levelFits("Total beginner", "some")).toBe(false);
    expect(levelFits("Beginner", "regular")).toBe(false);
    expect(levelFits("All levels", "regular")).toBe(true);
  });

  it("always returns a best match and 2 alternatives for every possible answer", () => {
    for (const g of QUIZ_GOALS)
      for (const e of EXPERIENCE_OPTIONS)
        for (const eq of EQUIPMENT_OPTIONS)
          for (const days of [3, 4, 5]) {
            const r = matchPlans(CATALOG, { goal: g.goal, experience: e.value, equipment: [eq.value], days }, null);
            expect(r?.best).toBeTruthy();
            expect(r?.also).toHaveLength(2);
          }
  });
});

describe("find your plan: wording", () => {
  it("why pills list what matches, with the crew's day count when it equals the pick", () => {
    expect(whyPills(plan("twenty-minute-burn"), { ...loseFatNew, days: 3 }, 3)).toEqual([
      "Lose fat",
      "No equipment",
      "Good for beginners",
      "3 days, like your crew",
    ]);
    expect(whyPills(plan("daily-mobility"), { goal: "mobility", experience: "new", equipment: ["none"], days: 5 }, null)).toEqual([
      "Mobility + core",
      "No equipment",
      "Good for all levels",
      "5 days a week",
    ]);
  });

  it("the equipment pill names the plan's equipment category", () => {
    expect(whyPills(plan("strength-foundations"), strongerGym, null)).toEqual([
      "Get stronger",
      "Gym",
      "Good if you train regularly",
      "3 days a week",
    ]);
  });

  it("difference line shows the first mismatch: goal, then equipment, then level, then days", () => {
    expect(differenceLine(plan("home-no-equipment"), loseFatNew)).toBe("Built for getting moving again instead");
    expect(differenceLine(plan("lose-fat"), loseFatNew)).toBe("Needs light dumbbells or water bottles");
    expect(differenceLine(plan("kettlebell-burn"), loseFatNew)).toBe("Needs one kettlebell");
    expect(differenceLine(plan("bodyweight-strength"), { ...strongerGym, experience: "new" })).toBe("Made for people who train regularly");
    expect(differenceLine(plan("twenty-minute-burn"), loseFatNew)).toBe("3 days a week instead of 5");
    expect(differenceLine(plan("strength-foundations"), strongerGym)).toBeNull();
  });

  it("crew days line only when the plan has fewer days than the crew rule", () => {
    expect(crewDaysLine(3, 5)).toBe("Your other 2 crew days: any walk, run or workout");
    expect(crewDaysLine(5, 5)).toBeNull();
    expect(crewDaysLine(3, null)).toBeNull();
    expect(matchPlans(CATALOG, loseFatNew, 5)!.crewLine).toBe("Your other 2 crew days: any walk, run or workout");
  });

  it("Q4 preselects the highest crew rule, capped at 5; nothing without a crew", () => {
    expect(presetDays([3, 4])).toBe(4);
    expect(presetDays([6])).toBe(5);
    expect(presetDays([])).toBeNull();
  });
});

describe("find your plan: browse with my answers", () => {
  it("maps answers to Discover filters: goal, picked equipment, level from experience, days", () => {
    expect(quizToFilters(strongerGym)).toEqual({ goal: ["strength"], equipment: ["gym"], level: ["intermediate"], days: ["3"], minutes: [] });
    expect(quizToFilters(loseFatNew).level).toEqual(["total-beginner", "beginner"]);
    const shown = filterPlans(CATALOG, quizToFilters(strongerGym)).map((p) => p.slug);
    expect(shown).toEqual(["strength-foundations"]);
  });

  it("keeps all four filters when they show a plan", () => {
    expect(browseFilters(CATALOG, strongerGym)).toEqual(quizToFilters(strongerGym));
  });

  it("Lose fat + new + no equipment + 5 days drops only Days → 20-Minute Burn", () => {
    const f = browseFilters(CATALOG, loseFatNew);
    expect(f.days).toEqual([]);
    expect(f.level).toEqual(["total-beginner", "beginner"]);
    expect(f.equipment).toEqual(["none"]);
    expect(filterPlans(CATALOG, f).map((p) => p.slug)).toEqual(["twenty-minute-burn"]);
  });

  it("Glutes + new + no equipment + 3 days drops Days, Level and Equipment, keeps Goal → all 3 glute plans", () => {
    const f = browseFilters(CATALOG, { goal: "glutes", experience: "new", equipment: ["none"], days: 3 });
    expect(f).toEqual({ goal: ["glutes"], equipment: [], level: [], days: [], minutes: [] });
    expect(filterPlans(CATALOG, f).map((p) => p.slug)).toEqual(["glute-builder", "glutes-at-home", "gym-glutes"]);
  });

  it("never lands on 0 plans for any answer combination", () => {
    for (const g of QUIZ_GOALS)
      for (const e of EXPERIENCE_OPTIONS)
        for (const q of EQUIPMENT_OPTIONS)
          for (const days of [3, 4, 5]) {
            const a: QuizAnswers = { goal: g.goal, experience: e.value, equipment: [q.value], days };
            expect(filterPlans(CATALOG, browseFilters(CATALOG, a)).length).toBeGreaterThan(0);
          }
  });
});
