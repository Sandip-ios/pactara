import { describe, expect, it } from "vitest";
import { NO_FILTERS } from "@/lib/plan-filters";
import { activePlanProgressLine, parseDiscoverTab, plansWithoutActive, selectedChipKey } from "@/lib/new-discover";

describe("new Discover tab param", () => {
  it("opens Plans only for ?tab=plans", () => expect(parseDiscoverTab("plans")).toBe("plans"));
  it("defaults to Workouts", () => {
    expect(parseDiscoverTab(undefined)).toBe("workouts");
    expect(parseDiscoverTab("workouts")).toBe("workouts");
    expect(parseDiscoverTab("posts")).toBe("workouts");
  });
});

describe("plan rows", () => {
  const plans = [{ slug: "build-muscle" }, { slug: "lose-fat" }, { slug: "glute-builder" }];
  it("never repeat the active plan", () => {
    expect(plansWithoutActive(plans, "lose-fat").map((p) => p.slug)).toEqual(["build-muscle", "glute-builder"]);
  });
  it("show every plan without an active one", () => expect(plansWithoutActive(plans, null)).toHaveLength(3));
});

describe("goal chips", () => {
  it("All is selected with no filters", () => expect(selectedChipKey(NO_FILTERS)).toBe("all"));
  it("Home means bodyweight or bands", () => expect(selectedChipKey({ ...NO_FILTERS, equipment: ["band", "none"] })).toBe("home"));
});

it("active plan progress line", () => {
  expect(activePlanProgressLine({ currentWeek: 2, weeks: 8, workoutsDone: 7, daysPerWeek: 5 })).toBe("Week 2 of 8 · 7 of 40 workouts done");
});
