import { describe, expect, it } from "vitest";
import { canSave, clampSets, defaultSets, draftMeta, estimateMinutes, moveItem, pickedIdsOf, sortMyWorkouts, syncPicks, type DraftItem } from "@/lib/workout-builder";

const item = (exerciseId: string, sets = 3, key = exerciseId): DraftItem => ({ key, exerciseId, sets });

describe("workout builder", () => {
  it("defaults to 3 sets, 2 for bodyweight", () => {
    expect(defaultSets("dumbbell")).toBe(3);
    expect(defaultSets("bodyweight")).toBe(2);
  });

  it("keeps sets between 1 and 10", () => {
    expect(clampSets(0)).toBe(1);
    expect(clampSets(11)).toBe(10);
    expect(clampSets(4)).toBe(4);
  });

  it("estimates about 2.6 min a set rounded to 5", () => {
    expect(estimateMinutes(11)).toBe(30);
    expect(estimateMinutes(12)).toBe(30);
    expect(estimateMinutes(9)).toBe(25);
    expect(estimateMinutes(1)).toBe(5);
  });

  it("writes the meta line", () => {
    expect(draftMeta([item("a"), item("b"), item("c", 2), item("d")])).toBe("4 exercises · 11 sets · about 30 min");
    expect(draftMeta([item("a", 1)])).toBe("1 exercise · 1 set · about 5 min");
  });

  it("can't save without a name or without exercises", () => {
    expect(canSave("Chest day", [item("a")])).toBe(true);
    expect(canSave("  ", [item("a")])).toBe(false);
    expect(canSave("Chest day", [])).toBe(false);
  });

  it("moves an exercise to a new spot", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("going back to the picker keeps set counts for exercises still picked", () => {
    const draft = [item("a", 5), item("b", 2)];
    const out = syncPicks(draft, ["b", "a", "c"], (id) => item(id, 3, `new-${id}`));
    expect(out.map((d) => [d.exerciseId, d.sets])).toEqual([["b", 2], ["a", 5], ["c", 3]]);
    expect(pickedIdsOf([item("a"), item("b"), item("a", 3, "a2")])).toEqual(["a", "b"]);
  });

  it("puts a just-built workout at the top of My workouts", () => {
    const list = [
      { id: "old", lastDoneAt: "2026-11-20T10:00:00Z", createdAt: "2026-11-01T10:00:00Z" },
      { id: "new", lastDoneAt: null, createdAt: "2026-11-23T02:00:00Z" },
      { id: "never", lastDoneAt: null, createdAt: "2026-11-02T10:00:00Z" },
    ];
    expect(sortMyWorkouts(list).map((w) => w.id)).toEqual(["new", "old", "never"]);
  });
});
