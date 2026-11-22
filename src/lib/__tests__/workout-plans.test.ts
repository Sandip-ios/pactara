import { describe, expect, it } from "vitest";
import {
  advancePlan,
  checkInActivityFor,
  dayForWeek,
  planStartAction,
  scheduleForWeek,
  searchPlans,
  suggestNextPlan,
  type Plan,
  type PlanDay,
} from "../workout-plans";
import { checkInMetaLine } from "../feed-view";
import { planChipLabel } from "../workout-plans";

const move = (name: string) => ({ name, dose: "3x10", plain: "Do it." });
const day = (dayNumber: number, title: string, moves: string[], weekNumber: number | null = null): PlanDay => ({
  dayNumber,
  weekNumber,
  title,
  minutes: null,
  note: null,
  moves: moves.map(move),
});
const plan = (over: Partial<Plan>): Plan => ({
  id: over.slug ?? "p",
  slug: "p",
  name: "Plan",
  goal: "muscle",
  level: "Beginner",
  weeks: 8,
  daysPerWeek: 5,
  minutes: "40",
  gear: [],
  summary: "",
  progressionRule: "",
  safetyNote: "",
  note: null,
  days: [],
  ...over,
});

describe("plan progress", () => {
  const muscle = { weeks: 8, daysPerWeek: 5 };
  it("moves to the next day in the same week", () => {
    expect(advancePlan({ week: 3, day: 1 }, muscle)).toEqual({ week: 3, day: 2, completed: false });
  });
  it("wraps to Day 1 of the next week after the last day", () => {
    expect(advancePlan({ week: 3, day: 5 }, muscle)).toEqual({ week: 4, day: 1, completed: false });
  });
  it("uses the plan's own days a week (Glute Builder has 4)", () => {
    expect(advancePlan({ week: 1, day: 4 }, { weeks: 6, daysPerWeek: 4 })).toEqual({ week: 2, day: 1, completed: false });
  });
  it("completes after the last day of the final week", () => {
    expect(advancePlan({ week: 8, day: 5 }, muscle)).toEqual({ week: 8, day: 5, completed: true });
    expect(advancePlan({ week: 4, day: 5 }, { weeks: 4, daysPerWeek: 5 }).completed).toBe(true);
  });
  it("is not complete one day before the end", () => {
    expect(advancePlan({ week: 8, day: 4 }, muscle)).toEqual({ week: 8, day: 5, completed: false });
  });
});

describe("one active plan per person", () => {
  it("starts a new run when there's no plan yet", () => {
    expect(planStartAction([], "a")).toEqual({ alreadyActiveId: null, stopIds: [], resumeId: null });
  });
  it("stops the current plan when switching", () => {
    expect(planStartAction([{ id: "u1", planId: "a", status: "active" }], "b")).toEqual({
      alreadyActiveId: null,
      stopIds: ["u1"],
      resumeId: null,
    });
  });
  it("resumes a stopped run of the same plan (progress kept)", () => {
    const rows = [
      { id: "u1", planId: "a", status: "stopped" as const },
      { id: "u2", planId: "b", status: "active" as const },
    ];
    expect(planStartAction(rows, "a")).toEqual({ alreadyActiveId: null, stopIds: ["u2"], resumeId: "u1" });
  });
  it("does nothing when you're already on that plan", () => {
    expect(planStartAction([{ id: "u1", planId: "a", status: "active" }], "a")).toEqual({
      alreadyActiveId: "u1",
      stopIds: [],
      resumeId: null,
    });
  });
  it("starts fresh after finishing a plan", () => {
    expect(planStartAction([{ id: "u1", planId: "a", status: "completed" }], "a").resumeId).toBeNull();
  });
});

describe("plan search", () => {
  const plans = [
    plan({ slug: "build-muscle", name: "Build Muscle", goal: "muscle", days: [day(1, "Push", ["Dumbbell bench press"])] }),
    plan({ slug: "lose-fat", name: "Lose Fat", goal: "fat_loss", days: [day(2, "Circuit", ["Dumbbell thruster", "Skater step"])] }),
    plan({ slug: "first-5k", name: "Run Your First 5K", goal: "run", days: [day(1, "Run", ["Run / walk"], 1)] }),
    plan({ slug: "walk-strength", name: "Walk + Strength", goal: "beginner", days: [day(2, "Easy strength", ["Wall push-up"])] }),
  ];
  const slugs = (q: string, g: Plan["goal"] | null = null) => searchPlans(plans, q, g).map((p) => p.slug);

  it("matches plan names, any case", () => {
    expect(slugs("muscle")).toEqual(["build-muscle"]);
    expect(slugs("5k")).toEqual(["first-5k"]);
  });
  it("matches goals by label or id", () => {
    expect(slugs("fat loss")).toEqual(["lose-fat"]);
    expect(slugs("get moving")).toEqual(["walk-strength"]);
  });
  it("matches move names", () => {
    expect(slugs("skater")).toEqual(["lose-fat"]);
    expect(slugs("push-up")).toEqual(["walk-strength"]);
    expect(slugs("dumbbell")).toEqual(["build-muscle", "lose-fat"]);
  });
  it("returns everything for an empty search and nothing for no match", () => {
    expect(slugs("  ")).toHaveLength(4);
    expect(slugs("yoga")).toEqual([]);
  });
  it("narrows by goal chip", () => {
    expect(slugs("", "run")).toEqual(["first-5k"]);
    expect(slugs("dumbbell", "fat_loss")).toEqual(["lose-fat"]);
  });
});

describe("plan days", () => {
  const fiveK = plan({
    daysPerWeek: 5,
    days: [
      day(1, "Run", ["Run / walk"], 1),
      day(1, "Run", ["Easy run"], 7),
      day(2, "Runner's strength", ["Bodyweight squat"]),
      day(3, "Run", ["Run / walk"], 1),
      day(4, "Runner's strength", ["Bodyweight squat"]),
      day(5, "Your 5K", ["Your 5K"], 8),
    ],
  });
  it("picks the week's run and the every-week strength day", () => {
    expect(dayForWeek(fiveK, 1, 7)?.moves[0]?.name).toBe("Easy run");
    expect(dayForWeek(fiveK, 2, 7)?.title).toBe("Runner's strength");
    expect(scheduleForWeek(fiveK, 1).map((d) => d.dayNumber)).toEqual([1, 2, 3, 4]);
  });
  it("tags run days Run and everything else Workout", () => {
    expect(checkInActivityFor(day(1, "Run", ["Brisk walk warm-up", "Run / walk"]))).toBe("run");
    expect(checkInActivityFor(day(5, "Your 5K", ["Your 5K"]))).toBe("run");
    expect(checkInActivityFor(day(2, "Runner's strength", ["Bodyweight squat", "Plank"]))).toBe("workout");
    expect(checkInActivityFor(day(1, "Walk", ["Easy walk"]))).toBe("workout");
  });
  it("suggests a next plan after finishing", () => {
    expect(suggestNextPlan("walk-strength")).toBe("home-no-equipment");
    expect(suggestNextPlan("unknown")).toBeNull();
  });
});

describe("feed post for a plan day", () => {
  it("keeps the normal meta line; the plan goes in its own chip", () => {
    expect(checkInMetaLine("workout", 12, "6:10 am")).toBe("💪 Workout · Day 12 · 6:10 am");
    expect(planChipLabel("Build Muscle", 3, 2)).toBe("Build Muscle · Week 3, Day 2");
  });
  it("is unchanged for ordinary check-ins", () => {
    expect(checkInMetaLine("run", 4, "7:00 pm")).toBe("🏃 Run · Day 4 · 7:00 pm");
  });
});
