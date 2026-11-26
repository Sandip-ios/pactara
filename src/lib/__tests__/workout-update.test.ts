import { describe, expect, it } from "vitest";
import { changesLine, doneSaveRow, mergeTemplate, templateFromLogger, updateRowState } from "../workout-update";

const saved = [
  { exerciseId: "row", sets: 3, reps: "10", restSeconds: 120, tip: "Squeeze at the top" },
  { exerciseId: "plank", sets: 3, seconds: 45 },
];
const names: Record<string, string> = { row: "Barbell row", plank: "Plank", face: "Face pull", bench: "Bench press", hold: "Wall sit" };
const nameOf = (id: string) => names[id] ?? id;

describe("mergeTemplate", () => {
  it("keeps reps, tip and seconds; set count comes from the logger", () => {
    const out = mergeTemplate(saved, [{ exerciseId: "row", sets: 4, restSeconds: 120 }, { exerciseId: "plank", sets: 2, restSeconds: 90 }], () => "reps");
    expect(out[0]).toEqual({ exerciseId: "row", sets: 4, reps: "10", restSeconds: 120, tip: "Squeeze at the top" });
    expect(out[1]).toEqual({ exerciseId: "plank", sets: 2, seconds: 45 });
  });
  it("keeps a changed rest from the logger", () => {
    expect(mergeTemplate(saved, [{ exerciseId: "row", sets: 3, restSeconds: 60 }], () => "reps")[0]!.restSeconds).toBe(60);
  });
  it("gives new exercises the builder defaults", () => {
    const out = mergeTemplate(saved, [{ exerciseId: "face", sets: 3 }, { exerciseId: "hold", sets: 3 }], (id) => (id === "hold" ? "timed" : "reps"));
    expect(out[0]).toMatchObject({ reps: "10" });
    expect(out[1]).toMatchObject({ seconds: 30 });
  });
  it("drops removed exercises", () => {
    expect(mergeTemplate(saved, [{ exerciseId: "row", sets: 3 }], () => "reps").map((e) => e.exerciseId)).toEqual(["row"]);
  });
  it("never writes fewer fields for the same exercise", () => {
    const out = mergeTemplate(saved, [{ exerciseId: "row", sets: 1, restSeconds: 120 }], () => "reps");
    expect(Object.keys(out[0]!).length).toBeGreaterThanOrEqual(Object.keys(saved[0]!).length);
  });
});

describe("templateFromLogger", () => {
  it("keeps unchecked exercises and counts set rows", () => {
    const t = templateFromLogger([
      { exerciseId: "row", name: "Barbell row", sets: [{ done: true }, { done: false }, { done: false }, { done: false }], restSeconds: 120, primary: [] },
      { exerciseId: "plank", name: "Plank", sets: [{ done: false }], restSeconds: 90, primary: [] },
    ]);
    expect(t.map((e) => [e.exerciseId, e.sets])).toEqual([["row", 4], ["plank", 1]]);
  });
});

describe("changesLine", () => {
  it("lists adds, removes and set counts", () => {
    expect(changesLine(saved, [{ exerciseId: "row", sets: 4 }, { exerciseId: "face", sets: 3, name: "Face pull" }], nameOf)).toBe(
      "Adds Face pull, removes Plank, 4 sets of Barbell row instead of 3.",
    );
  });
  it("caps the list and counts the rest", () => {
    const next = [{ exerciseId: "face", sets: 3 }, { exerciseId: "bench", sets: 3 }, { exerciseId: "hold", sets: 3 }];
    expect(changesLine(saved, next, nameOf)).toBe("Adds Face pull, adds Bench press, adds Wall sit, and 2 more changes.");
  });
  it("names a reorder", () => {
    expect(changesLine(saved, [{ exerciseId: "plank", sets: 3 }, { exerciseId: "row", sets: 3 }], nameOf)).toBe("New exercise order.");
  });
});

describe("update row", () => {
  const same = [{ exerciseId: "row", sets: 3, restSeconds: 120 }, { exerciseId: "plank", sets: 3, restSeconds: 90 }];
  it("hides when nothing structural changed", () => {
    expect(updateRowState(saved, same)).toEqual({ show: false, defaultOn: false });
  });
  it("shows, off by default, when something changed", () => {
    expect(updateRowState(saved, [...same, { exerciseId: "face", sets: 3, restSeconds: 90 }])).toEqual({ show: true, defaultOn: false });
  });
  it("new version: unchanged saved workout has no row, skipped exercise doesn't count", () => {
    const fw = { workoutId: "w1", title: "Pull", plan: null, template: [{ exerciseId: "row", sets: 1, restSeconds: 120 }], fullTemplate: same.map((e) => ({ ...e, name: nameOf(e.exerciseId) })) };
    expect(doneSaveRow("new", fw, saved, nameOf).show).toBe(false);
  });
  it("new version: changed saved workout row is off with the changes line", () => {
    const full = [{ exerciseId: "row", sets: 4, restSeconds: 120, name: "Barbell row" }, { exerciseId: "plank", sets: 3, restSeconds: 90, name: "Plank" }];
    const r = doneSaveRow("new", { workoutId: "w1", title: "Pull", plan: null, template: [], fullTemplate: full }, saved, nameOf);
    expect(r).toMatchObject({ show: true, defaultOn: false, title: "Update “Pull”", subtitle: "4 sets of Barbell row instead of 3." });
    expect(r.template).toBe(full);
  });
  it("classic stays as today: default on, checked-sets template, fixed copy", () => {
    const fw = { workoutId: "w1", title: "Pull", plan: null, template: [{ exerciseId: "row", sets: 1, restSeconds: 120 }], fullTemplate: [] };
    expect(doneSaveRow("classic", fw, saved, nameOf)).toEqual({
      show: true, defaultOn: true, title: "Update “Pull”", subtitle: "Next time starts with today's weights.", template: fw.template,
    });
    expect(doneSaveRow("classic", { ...fw, plan: {} }, saved, nameOf).defaultOn).toBe(false);
    expect(doneSaveRow("classic", { ...fw, template: [] }, saved, nameOf).show).toBe(false);
  });
  it("new version keeps Save as a workout as today for unsaved and plan days", () => {
    const fw = { workoutId: null, title: "Day 1", plan: {}, template: [{ exerciseId: "row", sets: 2, restSeconds: 90 }] };
    expect(doneSaveRow("new", fw, null, nameOf)).toMatchObject({ show: true, defaultOn: false, title: "Save as a workout", template: fw.template });
  });
});
