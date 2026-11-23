import { describe, expect, it } from "vitest";
import {
  GOAL_TILES,
  NO_FILTERS,
  chipValue,
  crewDaysNote,
  draftCount,
  filterPlans,
  levelTags,
  minutesBucket,
  optionCount,
  showPlansLabel,
  sortForDiscover,
  tileCount,
  type FilterablePlan,
} from "../plan-filters";

type P = FilterablePlan & { slug: string };
const p = (slug: string, over: Partial<P>): P => ({
  slug,
  daysPerWeek: 3,
  minutes: "30",
  equipmentKey: "none",
  level: "Beginner",
  goal: "muscle",
  ...over,
});
const plans: P[] = [
  p("walk", { daysPerWeek: 5, minutes: "20–35", level: "Total beginner", goal: "beginner" }),
  p("gym", { daysPerWeek: 4, minutes: "50", equipmentKey: "gym", level: "Intermediate", goal: "muscle" }),
  p("bands", { daysPerWeek: 3, minutes: "25", equipmentKey: "band", goal: "glutes" }),
  p("barbell", { daysPerWeek: 3, minutes: "50", equipmentKey: "gym", level: "Beginner–intermediate", goal: "strength" }),
  p("stretch", { daysPerWeek: 5, minutes: "15", level: "All levels", goal: "mobility" }),
  p("tenk", { daysPerWeek: 4, minutes: "30–60", equipmentKey: "shoes", level: "Beginner–intermediate", goal: "run" }),
];
const slugs = (xs: P[]) => xs.map((x) => x.slug);

describe("minutes buckets use the lower number", () => {
  it("buckets ranges and single values", () => {
    expect(minutesBucket("30–60")).toBe("25-30");
    expect(minutesBucket("20–35")).toBe("15-20");
    expect(minutesBucket("15")).toBe("15-20");
    expect(minutesBucket("40")).toBe("40-45");
    expect(minutesBucket("45")).toBe("40-45");
    expect(minutesBucket("50")).toBe("50+");
  });
});

describe("levels", () => {
  it("Beginner–intermediate matches Beginner and Intermediate; All levels matches every option", () => {
    expect(levelTags("Beginner–intermediate")).toEqual(["beginner", "intermediate"]);
    expect(levelTags("All levels")).toEqual(["total-beginner", "beginner", "intermediate"]);
    expect(levelTags("Total beginner")).toEqual(["total-beginner"]);
    expect(levelTags("Beginner")).toEqual(["beginner"]);
  });
  it("filters by level", () => {
    expect(slugs(filterPlans(plans, { ...NO_FILTERS, level: ["intermediate"] }))).toEqual(["gym", "barbell", "stretch", "tenk"]);
    expect(slugs(filterPlans(plans, { ...NO_FILTERS, level: ["total-beginner"] }))).toEqual(["walk", "stretch"]);
  });
});

describe("combining filters", () => {
  it("OR within a chip", () => {
    expect(slugs(filterPlans(plans, { ...NO_FILTERS, equipment: ["band", "shoes"] }))).toEqual(["bands", "tenk"]);
  });
  it("AND across chips", () => {
    expect(slugs(filterPlans(plans, { ...NO_FILTERS, days: ["3"], equipment: ["gym"] }))).toEqual(["barbell"]);
    expect(slugs(filterPlans(plans, { ...NO_FILTERS, days: ["3", "4"], minutes: ["50+"], goal: ["muscle", "strength"] }))).toEqual(["gym", "barbell"]);
  });
  it("hides plans that need equipment you didn't tick", () => {
    expect(slugs(filterPlans(plans, { ...NO_FILTERS, equipment: ["none"] }))).toEqual(["walk", "stretch"]);
  });
});

describe("sheet counts", () => {
  it("each option counts against the other chips, not its own", () => {
    const f = { ...NO_FILTERS, days: ["3"], equipment: ["gym"] };
    expect(optionCount(plans, f, "equipment", "band")).toBe(1);
    expect(optionCount(plans, f, "days", "4")).toBe(1);
  });
  it("Show N plans follows the draft and says No plans match at 0", () => {
    expect(draftCount(plans, { ...NO_FILTERS, goal: ["run"] }, "days", ["3"])).toBe(0);
    expect(draftCount(plans, NO_FILTERS, "days", ["3", "4"])).toBe(4);
    expect(showPlansLabel(0)).toBe("No plans match");
    expect(showPlansLabel(4)).toBe("Show 4 plans");
    expect(showPlansLabel(1)).toBe("Show 1 plan");
  });
});

describe("chips", () => {
  it("shows the single value or the number of options", () => {
    expect(chipValue("days", ["3"])).toBe("3 days");
    expect(chipValue("equipment", ["none"])).toBe("No equipment");
    expect(chipValue("goal", ["strength"])).toBe("Get stronger");
    expect(chipValue("minutes", ["15-20", "50+"])).toBe("2 options");
    expect(chipValue("level", [])).toBeNull();
  });
});

describe("goal tiles", () => {
  it("has 8 tiles in order, At home counting every no-equipment plan", () => {
    expect(GOAL_TILES.map((t) => t.label)).toEqual([
      "Build muscle",
      "Lose fat",
      "Glutes",
      "Get stronger",
      "Get moving again",
      "Run",
      "At home",
      "Mobility + core",
    ]);
    const home = GOAL_TILES.find((t) => t.key === "home")!;
    expect(tileCount(plans, home)).toBe(2);
    expect(tileCount(plans, GOAL_TILES.find((t) => t.key === "strength")!)).toBe(1);
  });
});

describe("order", () => {
  it("puts the active plan first, then catalog order", () => {
    expect(slugs(sortForDiscover(plans, "tenk"))).toEqual(["tenk", "walk", "gym", "bands", "barbell", "stretch"]);
    expect(slugs(sortForDiscover(plans, null))[0]).toBe("walk");
  });
});

describe("crew note for the Days a week filter", () => {
  it("shows when a crew asks for more days than the smallest ticked count", () => {
    expect(crewDaysNote(["3", "4"], [5])).toBe(
      "Your crew checks in 5 days a week? A 3-day plan still works. The other 2 days are your choice: a walk, a run or any workout.",
    );
    expect(crewDaysNote(["4"], [3, 5])).toBe(
      "Your crew checks in 5 days a week? A 4-day plan still works. The other 1 day is your choice: a walk, a run or any workout.",
    );
  });
  it("stays hidden otherwise", () => {
    expect(crewDaysNote(["5"], [5])).toBeNull();
    expect(crewDaysNote([], [5])).toBeNull();
    expect(crewDaysNote(["3"], [])).toBeNull();
  });
});
