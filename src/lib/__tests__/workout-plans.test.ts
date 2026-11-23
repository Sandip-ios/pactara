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
import {
  crewProofLine,
  lighterDose,
  moveGroup,
  movesForWeek,
  muscleMapLabel,
  planChipLabel,
  planMuscleMap,
  plansPerGoal,
} from "../workout-plans";

const move = (name: string) => ({ name, dose: "3x10", plain: "Do it." });
const day = (dayNumber: number, title: string, moves: string[], weekNumber: number | null = null): PlanDay => ({
  dayNumber,
  weekNumber,
  title,
  minutes: null,
  note: null,
  moves: moves.map(move),
  muscles: {},
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
  coverUrl: null,
  coverCredit: null,
  focusLine: null,
  gearShort: null,
  equipmentKey: "dumbbells",
  weekNotes: [],
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
  it("matches the summary but not move names", () => {
    const withSummary = [plan({ slug: "a", name: "A", summary: "Swings and carries with one kettlebell" }), plan({ slug: "b", name: "B", days: [day(1, "Day", ["Kettlebell swing"])] })];
    expect(searchPlans(withSummary, "carries").map((p) => p.slug)).toEqual(["a"]);
    expect(slugs("skater")).toEqual([]);
  });
  it("returns everything for an empty search and nothing for no match", () => {
    expect(slugs("  ")).toHaveLength(4);
    expect(slugs("yoga")).toEqual([]);
  });
  it("narrows by goal chip", () => {
    expect(slugs("", "run")).toEqual(["first-5k"]);
    expect(slugs("lose", "fat_loss")).toEqual(["lose-fat"]);
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

describe("plan page and Discover helpers", () => {
  it("plan body map takes the strongest level per region across days", () => {
    const p = plan({
      days: [
        { ...day(1, "Push", ["Bench"]), muscles: { chest: 2, abs: 1 } },
        { ...day(2, "Full", ["Row"]), muscles: { chest: 1, abs: 2, back: 1 } },
      ],
    });
    expect(planMuscleMap(p)).toEqual({ chest: 2, abs: 2, back: 1 });
    expect(muscleMapLabel({ chest: 2, shoulders: 2, triceps: 2, abs: 1 })).toBe(
      "Main muscles: chest, shoulders and triceps. Also worked: core.",
    );
  });
  it("a lighter week is 2 sets of everything", () => {
    expect(lighterDose("3x8-12")).toBe("2x8-12");
    expect(lighterDose("3x8 each leg")).toBe("2x8 each leg");
    expect(lighterDose("2x12-15")).toBe("2x12-15");
    expect(lighterDose("2 sets, stop 2 reps short")).toBe("2 sets, stop 2 reps short");
    expect(lighterDose("3 sets, stop 2 reps short")).toBe("2 sets, stop 2 reps short");
    expect(movesForWeek([move("Goblet squat")], false)[0]!.dose).toBe("3x10");
    expect(movesForWeek([move("Goblet squat")], true)[0]!.dose).toBe("2x10");
  });
  it("counts plans per goal tile", () => {
    const counts = plansPerGoal([plan({ goal: "muscle" }), plan({ goal: "run" }), plan({ goal: "muscle" })]);
    expect(counts.muscle).toBe(2);
    expect(counts.run).toBe(1);
    expect(counts.glutes).toBe(0);
  });
  it("search finds no-equipment plans and gear", () => {
    const home = plan({ slug: "home", name: "Home", goal: "beginner", gear: [], equipmentKey: "none" });
    const muscle = plan({ slug: "m", name: "Build Muscle", gear: ["Pair of dumbbells"] });
    expect(searchPlans([home, muscle], "no equipment").map((p) => p.slug)).toEqual(["home"]);
    expect(searchPlans([home, muscle], "dumbbells").map((p) => p.slug)).toEqual(["m"]);
    expect(searchPlans([home, muscle], "get stronger")).toEqual([]);
  });
  it("tags each move with a muscle group", () => {
    expect(moveGroup("Dumbbell bench press")).toBe("CH");
    expect(moveGroup("Dumbbell shoulder press")).toBe("SH");
    expect(moveGroup("One-arm dumbbell row")).toBe("BK");
    expect(moveGroup("Goblet squat")).toBe("LG");
    expect(moveGroup("Hammer curl")).toBe("AR");
    expect(moveGroup("Dead bug")).toBe("CO");
    expect(moveGroup("Dumbbell hip thrust")).toBe("GL");
  });
  it("words the crew line on a plan page", () => {
    const b = { firstName: "Bertille", status: "completed" as const, currentWeek: 6 };
    const m = { firstName: "Michele", status: "completed" as const, currentWeek: 6 };
    expect(crewProofLine([])).toBeNull();
    expect(crewProofLine([b, m])).toEqual({ bold: "Bertille and Michele", rest: " from your crew finished this plan." });
    expect(crewProofLine([{ ...b, status: "active", currentWeek: 3 }])).toEqual({
      bold: "Bertille",
      rest: " from your crew is on week 3.",
    });
    expect(crewProofLine([b, m, { ...b, firstName: "Ana" }])?.bold).toBe("3 people");
  });
});
