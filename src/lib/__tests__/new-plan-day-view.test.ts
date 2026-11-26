import { describe, expect, it } from "vitest";
import { muscleLegend, newPlanDayLabel, newPlanDayMeta, shortDose } from "@/lib/new-plan-day-view";

describe("new plan day label", () => {
  it("adds TODAY only on my active plan's next day", () => {
    expect(newPlanDayLabel("Build Muscle", true)).toBe("BUILD MUSCLE · TODAY");
    expect(newPlanDayLabel("Build Muscle", false)).toBe("BUILD MUSCLE");
  });
});

describe("muscle legend", () => {
  it("joins main muscles in sentence case and secondary separately", () => {
    const l = muscleLegend({ chest: 2, shoulders: 2, triceps: 2, abs: 1 });
    expect(l.primary).toBe("Chest, shoulders, triceps");
    expect(l.secondary).toBe("Core");
  });
  it("hides the amber row when nothing is secondary", () => {
    expect(muscleLegend({ quads: 2 }).secondary).toBeNull();
  });
});

describe("dose and meta", () => {
  it("shortens doses", () => {
    expect(shortDose("3x8-12")).toBe("3 × 8-12");
    expect(shortDose("5 min")).toBe("5 min");
  });
  it("builds the meta line with the week note", () => {
    expect(newPlanDayMeta(5, "35", "Same weights, one more rep where you can.")).toBe("5 exercises · 35 min · same weights, one more rep where you can");
  });
});
