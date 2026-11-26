import { describe, expect, it } from "vitest";
import { builderDirty, builderMinutes, builderSignature, canSaveBuilder, equipmentFromExercises, pillText, reorderItems, savePayload, stepReps, toggleEach, type BuilderState } from "@/lib/new-workout-builder";

const item = (id: string, sets: number, reps = "", tip = "") => ({ key: id, exerciseId: id, sets, reps, tip });
const backDay: BuilderState = {
  workoutId: null,
  name: "  Back day ",
  equipment: "gym",
  items: [item("barbell-row", 4, "8", " Pull to your belly button "), item("lat-pulldown", 3, "12"), item("single-arm-db-row", 3, "10 each"), item("hammer-curl", 4, "10")],
};

describe("save payload", () => {
  it("writes name, equipment, order, sets, reps and tips", () => {
    expect(savePayload(backDay)).toEqual({
      workoutId: null,
      name: "Back day",
      equipment: "gym",
      exercises: [
        { exerciseId: "barbell-row", sets: 4, reps: "8", tip: "Pull to your belly button" },
        { exerciseId: "lat-pulldown", sets: 3, reps: "12" },
        { exerciseId: "single-arm-db-row", sets: 3, reps: "10 each" },
        { exerciseId: "hammer-curl", sets: 4, reps: "10" },
      ],
    });
  });
  it("keeps rest as it was and caps tips at 120", () => {
    const p = savePayload({ ...backDay, items: [{ ...item("x", 3, "", "a".repeat(200)), restSeconds: 90 }] });
    expect(p.exercises[0]).toEqual({ exerciseId: "x", sets: 3, tip: "a".repeat(120), restSeconds: 90 });
  });
});

describe("dirty check", () => {
  it("is clean when nothing changed and dirty after a reps edit", () => {
    const initial = builderSignature(backDay);
    expect(builderDirty(initial, backDay)).toBe(false);
    expect(builderDirty(initial, { ...backDay, items: backDay.items.map((i, n) => (n === 1 ? { ...i, reps: "10" } : i)) })).toBe(true);
  });
  it("a new empty workout is clean", () => {
    const empty: BuilderState = { workoutId: null, name: "", equipment: null, items: [] };
    expect(builderDirty(builderSignature(empty), empty)).toBe(false);
    expect(canSaveBuilder(empty)).toBe(false);
    expect(canSaveBuilder({ name: "Back day", items: [] })).toBe(false);
    expect(canSaveBuilder(backDay)).toBe(true);
  });
});

describe("minutes and reorder", () => {
  it("uses the builder estimate: 14 sets is 35 min, 20 sets is 50 min", () => {
    expect(builderMinutes(backDay.items)).toBe(35);
    expect(builderMinutes([item("a", 10), item("b", 10)])).toBe(50);
    expect(builderMinutes([])).toBe(0);
  });
  it("moves a row and the payload follows the new order", () => {
    const moved = reorderItems(backDay.items, 3, 0);
    expect(moved.map((i) => i.exerciseId)).toEqual(["hammer-curl", "barbell-row", "lat-pulldown", "single-arm-db-row"]);
    expect(builderDirty(builderSignature(backDay), { ...backDay, items: moved })).toBe(true);
  });
});

describe("equipment and reps", () => {
  it("prefills equipment from the exercises", () => {
    expect(equipmentFromExercises(["barbell", "dumbbell"])).toBe("gym");
    expect(equipmentFromExercises(["dumbbell", "bodyweight"])).toBe("dumbbells");
    expect(equipmentFromExercises(["bodyweight", "band"])).toBe("home");
    expect(equipmentFromExercises([])).toBeNull();
  });
  it("steps reps and keeps each", () => {
    expect(stepReps("10 each", 1)).toBe("11 each");
    expect(stepReps("1", -1)).toBe("1");
    expect(toggleEach("10")).toBe("10 each");
    expect(toggleEach("10 each")).toBe("10");
    expect(pillText({ sets: 4, reps: "8" })).toBe("4 × 8");
    expect(pillText({ sets: 3, reps: "" })).toBe("3 sets");
  });
});

import { newItemDose as _newItemDose, pillText as _pillText } from "../new-workout-builder";
describe("new exercise defaults and pill", () => {
  it("added rep exercise is 3 × 10", () => expect(_pillText(_newItemDose("reps"))).toBe("3 × 10"));
  it("added timed exercise is 3 × 30s", () => expect(_pillText(_newItemDose("timed"))).toBe("3 × 30s"));
  it("reps show sets × reps", () => expect(_pillText({ sets: 4, reps: "8" })).toBe("4 × 8"));
  it("old saved item with no reps keeps N sets", () => expect(_pillText({ sets: 3, reps: "" })).toBe("3 sets"));
});
