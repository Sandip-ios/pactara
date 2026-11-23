import { describe, expect, it } from "vitest";
import { canCheckOffSet, carryLoggedSetForward } from "@/lib/lift-rules";

const reps = { logType: "reps" as const, loadable: true };
const bodyweight = { logType: "reps" as const, loadable: false };
const timed = { logType: "timed" as const, loadable: false };

describe("canCheckOffSet", () => {
  it("blocks an empty 0 lb × 0 reps set", () => {
    expect(canCheckOffSet({ weight: null, reps: null, seconds: null }, reps)).toBe(false);
    expect(canCheckOffSet({ weight: 0, reps: 0, seconds: null }, reps)).toBe(false);
  });
  it("needs reps even when a weight is set", () => {
    expect(canCheckOffSet({ weight: 35, reps: null, seconds: null }, reps)).toBe(false);
  });
  it("needs a weight for loadable moves", () => {
    expect(canCheckOffSet({ weight: null, reps: 10, seconds: null }, reps)).toBe(false);
    expect(canCheckOffSet({ weight: 35, reps: 10, seconds: null }, reps)).toBe(true);
  });
  it("lets bodyweight moves leave the weight empty", () => {
    expect(canCheckOffSet({ weight: null, reps: 12, seconds: null }, bodyweight)).toBe(true);
    expect(canCheckOffSet({ weight: null, reps: 0, seconds: null }, bodyweight)).toBe(false);
  });
  it("timed moves need seconds", () => {
    expect(canCheckOffSet({ weight: null, reps: null, seconds: null }, timed)).toBe(false);
    expect(canCheckOffSet({ weight: null, reps: null, seconds: 45 }, timed)).toBe(true);
  });
});

const set = (weight: number | null, r: number | null, done = false) => ({ weight, reps: r, seconds: null, done });

describe("carryLoggedSetForward", () => {
  it("prefills an empty next set with what was just logged", () => {
    const out = carryLoggedSetForward([set(35, 10, true), set(null, null), set(null, null)], 0);
    expect(out[1]).toMatchObject({ weight: 35, reps: 10, done: false });
    expect(out[2]).toMatchObject({ weight: null, reps: null });
  });
  it("leaves a next set that already has values", () => {
    const sets = [set(35, 10, true), set(40, 8)];
    expect(carryLoggedSetForward(sets, 0)).toBe(sets);
  });
  it("does nothing for the last set or an undone set", () => {
    const last = [set(35, 10), set(35, 10, true)];
    expect(carryLoggedSetForward(last, 1)).toBe(last);
    const undone = [set(35, 10, false), set(null, null)];
    expect(carryLoggedSetForward(undone, 0)).toBe(undone);
  });
});
