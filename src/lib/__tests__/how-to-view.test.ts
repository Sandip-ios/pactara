import { describe, expect, it } from "vitest";
import { buildHowTo, cleanSteps, easierInGroup, planMoveFor } from "../how-to-view";
import type { LibraryExercise } from "../exercise-library";

const lib = (id: string, over: Partial<LibraryExercise> = {}): LibraryExercise => ({
  id,
  name: id,
  primary: ["chest"],
  secondary: ["triceps"],
  equipment: "dumbbell",
  category: "strength",
  logType: "reps",
  imageStart: null,
  imagePeak: null,
  custom: false,
  difficulty: "intermediate",
  variationGroup: "bench-press",
  ...over,
});
const label = () => "Dumbbell";

describe("cleanSteps", () => {
  it("drops a final bare Repeat step", () => {
    expect(cleanSteps(["Lie down.", "Press up.", "Repeat."])).toEqual(["Lie down.", "Press up."]);
    expect(cleanSteps(["Press up.", "Repeat for the desired number of reps."])).toEqual(["Press up."]);
  });
  it("keeps a repeat step that says something", () => {
    expect(cleanSteps(["Step out.", "Repeat on both sides."])).toEqual(["Step out.", "Repeat on both sides."]);
  });
});

describe("plan moves use our own copy", () => {
  const bench = {
    name: "Dumbbell bench press",
    dose: "3x8-12",
    plain: "Lie on a bench, press weights up from your chest",
    exercise_id: "db-bench-press",
    easier: { name: "Machine chest press", note: "Or use lighter dumbbells", exercise_id: "chest-press-machine" },
    harder: { name: "Lower for 4 seconds", note: "Or go up 5 lb" },
  };
  const plans = [{ days: [{ moves: [bench] }] }];
  it("finds the plan move for a library exercise", () => {
    expect(planMoveFor(plans, "db-bench-press")?.name).toBe("Dumbbell bench press");
    expect(planMoveFor(plans, "arnold-press")).toBeNull();
  });
  it("shows bench press too hard / too easy as given, and hides missing mistakes", () => {
    const v = buildHowTo({ ex: lib("db-bench-press"), planMove: bench, detail: { instructions: ["A.", "Repeat."], tips: ["Tip"], description: "RepDB" }, library: [], equipmentLabel: label });
    expect(v.title).toBe("Dumbbell bench press");
    expect(v.plain).toBe("Lie on a bench, press weights up from your chest");
    expect(v.easier).toEqual({ name: "Machine chest press", note: "Or use lighter dumbbells", exerciseId: "chest-press-machine" });
    expect(v.harder).toEqual({ name: "Lower for 4 seconds", note: "Or go up 5 lb", exerciseId: null });
    expect(v.mistakes).toBeNull();
    expect(v.tips).toBeNull();
    expect(v.steps).toEqual(["A."]);
  });
  it("a plan move with no options hides Make it fit you", () => {
    const v = buildHowTo({ ex: lib("lateral-raise"), planMove: { name: "Lateral raise", dose: "2x12", plain: "x", exercise_id: "lateral-raise" }, detail: null, library: [], equipmentLabel: label });
    expect(v.easier).toBeNull();
    expect(v.harder).toBeNull();
  });
});

describe("library-only exercises", () => {
  it("easier = a beginner from the same variation group", () => {
    const ex = lib("bench-press");
    const easy = lib("push-up-bench", { difficulty: "beginner" });
    const other = lib("pec-fly", { difficulty: "beginner", variationGroup: "fly" });
    expect(easierInGroup(ex, [ex, easy, other])?.id).toBe("push-up-bench");
  });
  it("prefers the same kind of move and equipment", () => {
    const ex = lib("arnold-press");
    const hold = lib("a-rack-hold", { difficulty: "beginner", logType: "timed" });
    const band = lib("b-banded-press", { difficulty: "beginner", equipment: "band" });
    const machine = lib("c-machine-press", { difficulty: "beginner", equipment: "machine" });
    const db = lib("d-db-press", { difficulty: "beginner" });
    expect(easierInGroup(ex, [hold, band, machine, db])?.id).toBe("d-db-press");
    expect(easierInGroup(ex, [hold, band, machine])?.id).toBe("b-banded-press");
  });
  it("no beginner in the group (or already beginner) → no easier option", () => {
    expect(easierInGroup(lib("a"), [lib("a"), lib("b", { difficulty: "advanced" })])).toBeNull();
    expect(easierInGroup(lib("a", { difficulty: "beginner" }), [lib("b", { difficulty: "beginner" })])).toBeNull();
  });
  it("uses RepDB description, steps and tips", () => {
    const v = buildHowTo({ ex: lib("arnold-press"), planMove: null, detail: { instructions: ["Sit.", "Press."], tips: ["Go slow."], description: "A shoulder press." }, library: [], equipmentLabel: label });
    expect(v.plain).toBe("A shoulder press.");
    expect(v.tips).toEqual(["Go slow."]);
    expect(v.mistakes).toBeNull();
  });
});
