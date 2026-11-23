import { describe, expect, it } from "vitest";
import { formatPlanDose, levelChip, minusMinutes, planDayBlocks, planDayKicker, resolvePlanDayPosition } from "../plan-day-view";
import { lighterDose } from "../workout-plans";

const mv = (name: string, dose: string) => ({ name, dose, plain: "" });

describe("formatPlanDose", () => {
  it("writes sets × reps with the logger's 90 sec rest", () => {
    expect(formatPlanDose("3x8-12")).toBe("3 sets × 8-12 reps · rest 90 sec");
    expect(formatPlanDose("2x8 each leg")).toBe("2 sets × 8 reps each leg · rest 90 sec");
  });
  it("timed sets rest 60 sec", () => {
    expect(formatPlanDose("3x30 sec")).toBe("3 sets × 30 sec · rest 60 sec");
  });
  it("leaves walks and rounds as written", () => {
    expect(formatPlanDose("5 min")).toBe("5 min");
    expect(formatPlanDose("8 rounds: run 1 min / walk 90 sec")).toBe("8 rounds: run 1 min / walk 90 sec");
  });
  it("Build Muscle week 4 shows the lighter 2-set dose", () => {
    expect(formatPlanDose(lighterDose("3x8-12"))).toBe("2 sets × 8-12 reps · rest 90 sec");
  });
});

describe("planDayBlocks", () => {
  it("a day with no warm-up or cool-down shows only WORKOUT", () => {
    const blocks = planDayBlocks([mv("Dumbbell bench press", "3x8-12"), mv("Lateral raise", "2x12-15")], "40");
    expect(blocks.map((b) => b.label)).toEqual(["WORKOUT"]);
    expect(blocks[0]!.meta).toBe("2 exercises · 40 min");
  });
  it("a warm-up move gets its own 5 min block and comes off the workout time", () => {
    const blocks = planDayBlocks([mv("Brisk walk warm-up", "5 min"), mv("Run / walk", "8 rounds")], "25");
    expect(blocks.map((b) => [b.label, b.meta])).toEqual([
      ["WARM-UP", "5 min"],
      ["WORKOUT", "1 exercise · 20 min"],
    ]);
  });
  it("minute ranges shrink at both ends", () => {
    expect(minusMinutes("25–35", 5)).toBe("20–30");
  });
});

describe("page labels and position", () => {
  it("kicker is uppercase plan · week · day", () => {
    expect(planDayKicker("Build Muscle", 3, 1)).toBe("BUILD MUSCLE · WEEK 3 · DAY 1");
  });
  it("Beginner reads Beginner friendly", () => {
    expect(levelChip("Beginner")).toBe("Beginner friendly");
    expect(levelChip("Total beginner")).toBe("Total beginner");
  });
  it("uses the asked-for day, else your next day, else week 1 day 1", () => {
    const shape = { weeks: 8, daysPerWeek: 5 };
    expect(resolvePlanDayPosition({ week: 4, day: 1 }, shape, { week: 2, day: 3 })).toEqual({ week: 4, day: 1 });
    expect(resolvePlanDayPosition({}, shape, { week: 2, day: 3 })).toEqual({ week: 2, day: 3 });
    expect(resolvePlanDayPosition({ week: 99, day: 9 }, shape, null)).toEqual({ week: 1, day: 1 });
  });
});
