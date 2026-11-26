import { describe, expect, it } from "vitest";
import { canCheckOffSet, missingSetField, parseRepTarget, progression } from "@/lib/lift-rules";
import { newLoggerTip } from "@/lib/new-workout-logger";

const set = (weight: number | null, reps: number | null) => ({ weight, reps, seconds: null, unit: "lb" as const });
const last = (...s: ReturnType<typeof set>[]) => ({ date: "2026-11-20", sets: s });
const base = { target: null, unit: "lb" as const, logType: "reps" as const, loadable: true };

describe("progression with a reps target", () => {
  it("single target hit on every set suggests the next step", () => {
    expect(progression({ ...base, last: last(set(150, 5), set(150, 5), set(150, 5), set(150, 5)), repTarget: { lo: 5, hi: 5 } }).tip).toBe("Next time: try 155 lb.");
  });
  it("single target missed keeps the weight and aims for N on every set", () => {
    expect(progression({ ...base, last: last(set(150, 5), set(150, 4)), repTarget: { lo: 5, hi: 5 } }).tip).toBe("Next time: 150 lb again. Aim for 5 reps on every set.");
  });
  it("one set says Aim for N reps.", () => {
    expect(progression({ ...base, last: last(set(150, 3)), repTarget: { lo: 5, hi: 5 } }).tip).toBe("Next time: 150 lb again. Aim for 5 reps.");
  });
  it("range uses hi as the top", () => {
    expect(progression({ ...base, last: last(set(100, 12), set(100, 12)), repTarget: { lo: 8, hi: 12 } }).tip).toBe("Next time: try 105 lb.");
    expect(progression({ ...base, last: last(set(100, 10), set(100, 12)), repTarget: { lo: 8, hi: 12 } }).tip).toBe("Next time: 100 lb again. Aim for 12 reps on every set.");
  });
  it("classic output without a target is unchanged", () => {
    expect(progression({ ...base, last: last(set(150, 5), set(150, 5)) }).tip).toBe("Next time: 150 lb again. Aim for 12 reps on every set.");
    expect(progression({ ...base, last: last(set(150, 12), set(150, 12)) }).tip).toBe("You hit 12 on every set. Try 155 lb next time.");
  });
  it("parses item reps", () => {
    expect(parseRepTarget("5")).toEqual({ lo: 5, hi: 5 });
    expect(parseRepTarget("8-12")).toEqual({ lo: 8, hi: 12 });
    expect(parseRepTarget("")).toBeNull();
  });
  it("new logger uses the item goal, else the stored tip", () => {
    const ex = { tip: "stored", target: null, last: last(set(150, 5), set(150, 5)), logType: "reps" as const, loadable: true };
    expect(newLoggerTip({ ...ex, repsGoal: "5" }, "lb")).toBe("Next time: try 155 lb.");
    expect(newLoggerTip({ ...ex, repsGoal: null }, "lb")).toBe("stored");
    expect(newLoggerTip({ ...ex, target: { sets: 4, repsLo: 5, repsHi: 5, seconds: null } }, "lb")).toBe("Next time: try 155 lb.");
  });
});

describe("missing field when a set can't be checked off", () => {
  const loadable = { logType: "reps" as const, loadable: true };
  it("weight first, then reps", () => {
    expect(missingSetField(set(null, 5), loadable)).toBe("weight");
    expect(missingSetField(set(null, null), loadable)).toBe("weight");
    expect(missingSetField(set(100, null), loadable)).toBe("reps");
    expect(missingSetField(set(100, 5), loadable)).toBeNull();
  });
  it("bodyweight and timed need no weight", () => {
    expect(canCheckOffSet(set(null, 10), { logType: "reps", loadable: false })).toBe(true);
    expect(missingSetField({ weight: null, reps: null, seconds: null }, { logType: "timed", loadable: false })).toBe("time");
    expect(missingSetField({ weight: null, reps: null, seconds: 30 }, { logType: "timed", loadable: false })).toBeNull();
  });
});
