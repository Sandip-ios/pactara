import { describe, expect, it } from "vitest";
import {
  mealMacroLine,
  postExerciseDose,
  postSectionCanSave,
  sectionPreview,
} from "../post-sections";
describe("full post sections", () => {
  it("shows three of four rows and exposes the full count", () =>
    expect(sectionPreview(["a", "b", "c", "d"])).toEqual({
      rows: ["a", "b", "c"],
      more: true,
      total: 4,
    }));
  it("does not show See all at three rows", () =>
    expect(sectionPreview([1, 2, 3]).more).toBe(false));
  it("own posts never offer an attachment save", () => {
    expect(postSectionCanSave(true)).toBe(false);
    expect(postSectionCanSave(false)).toBe(true);
  });
  it("formats sets and reps without weights", () =>
    expect(
      postExerciseDose({
        exerciseId: "e",
        name: "Press",
        imageStart: null,
        logType: "reps",
        sets: Array.from({ length: 3 }, () => ({ reps: 12, seconds: null, isPr: false })),
      }),
    ).toBe("3 × 12"));
  it("formats timed exercises", () =>
    expect(
      postExerciseDose({
        exerciseId: "e",
        name: "Plank",
        imageStart: null,
        logType: "timed",
        sets: [{ reps: null, seconds: 30, isPr: false }],
      }),
    ).toBe("1 × 30 sec"));
  it("formats approximate meal macros", () =>
    expect(mealMacroLine({ title: "Lunch", items: [], calories: 640, protein: 62 })).toBe(
      "About 640 cal · 62 g protein",
    ));
});
