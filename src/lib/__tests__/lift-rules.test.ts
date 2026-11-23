import { describe, expect, it } from "vitest";
import {
  beatsBest,
  bestOf,
  markPrs,
  nextQuickPick,
  nextTimeTip,
  parseDose,
  prefillSets,
  progression,
  setsShort,
  skipsStartScreen,
  suggestWorkoutName,
  type SetEntry,
} from "@/lib/lift-rules";

const lb = (weight: number | null, reps: number | null): SetEntry => ({ weight, reps, seconds: null, unit: "lb" });

describe("PR detection", () => {
  const best = bestOf([lb(35, 10), lb(35, 10), lb(30, 12)]);

  it("previous best is the heaviest set, ties broken by reps", () => {
    expect(best).toMatchObject({ weight: 35, reps: 10 });
  });
  it("heavier for at least as many reps is a PR", () => {
    expect(beatsBest(best, lb(40, 10))).toBe(true);
  });
  it("heavier but fewer reps is not a PR", () => {
    expect(beatsBest(best, lb(40, 8))).toBe(false);
  });
  it("more reps at the same weight is a PR", () => {
    expect(beatsBest(best, lb(35, 11))).toBe(true);
  });
  it("same weight and reps is not a PR", () => {
    expect(beatsBest(best, lb(35, 10))).toBe(false);
  });
  it("a first-ever session has nothing to beat", () => {
    expect(markPrs([], [lb(35, 10), lb(40, 10)])).toEqual([false, true]);
  });
  it("each set is compared with the sets before it in the same session", () => {
    // 40×10 beats 35×10; the next 40×10 only ties it.
    expect(markPrs([lb(35, 10)], [lb(40, 10), lb(40, 10), lb(40, 11)])).toEqual([true, false, true]);
  });
  it("compares across units", () => {
    const kgBest = bestOf([{ weight: 20, reps: 10, seconds: null, unit: "kg" }]); // ≈ 44.1 lb
    expect(beatsBest(kgBest, lb(45, 10))).toBe(true);
    expect(beatsBest(kgBest, lb(40, 10))).toBe(false);
  });
});

describe("prefill", () => {
  const last = { date: "2026-11-19", sets: [lb(35, 10), lb(35, 10), lb(35, 8)] };

  it("starts each set from the last session of that exercise", () => {
    const sets = prefillSets({ last, target: null, unit: "lb", logType: "reps", loadable: true, isPlan: false });
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[35, 10], [35, 10], [35, 8]]);
  });
  it("repeats the last set when today has more sets", () => {
    const sets = prefillSets({ last, target: null, unit: "lb", logType: "reps", loadable: true, isPlan: false, count: 4 });
    expect(sets[3]).toMatchObject({ weight: 35, reps: 8 });
  });
  it("converts last session's weights to the member's unit", () => {
    const sets = prefillSets({ last, target: null, unit: "kg", logType: "reps", loadable: true, isPlan: false });
    expect(sets[0]!.weight).toBe(16); // 35 lb ≈ 15.9 kg → nearest 0.25
  });
  it("plan workout: top of the range on all sets adds 5 lb and restarts at the bottom of the range", () => {
    const top = { date: "2026-11-19", sets: [lb(35, 12), lb(35, 12), lb(35, 12)] };
    const sets = prefillSets({ last: top, target: parseDose("3x8-12"), unit: "lb", logType: "reps", loadable: true, isPlan: true });
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[40, 8], [40, 8], [40, 8]]);
  });
  it("plan workout below the top of the range keeps the weight", () => {
    const sets = prefillSets({ last, target: parseDose("3x8-12"), unit: "lb", logType: "reps", loadable: true, isPlan: true });
    expect(sets.map((s) => s.weight)).toEqual([35, 35, 35]);
  });
  it("Build Muscle lighter week: 2 sets", () => {
    const sets = prefillSets({ last, target: parseDose("2x8-12"), unit: "lb", logType: "reps", loadable: true, isPlan: true });
    expect(sets).toHaveLength(2);
  });
  it("no history and a plan dose: reps from the bottom of the range, no weight", () => {
    const sets = prefillSets({ last: null, target: parseDose("3x8-12"), unit: "lb", logType: "reps", loadable: true, isPlan: true });
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[null, 8], [null, 8], [null, 8]]);
  });
  it("timed moves prefill seconds", () => {
    const sets = prefillSets({ last: null, target: parseDose("3x30 sec"), unit: "lb", logType: "timed", loadable: false, isPlan: true });
    expect(sets.map((s) => s.seconds)).toEqual([30, 30, 30]);
  });
});

describe("progression suggestion", () => {
  it("not every set at the top: aim for it, then go up 5 lb", () => {
    const p = progression({ last: { date: "x", sets: [lb(35, 10), lb(35, 10), lb(35, 8)] }, target: null, unit: "lb", logType: "reps", loadable: true });
    expect(p.tip).toBe("Last time you hit 10, 10, 8. Get 10 on all 3 sets and go up to 40 lb next time.");
    expect(p.allTop).toBe(false);
  });
  it("plan rule: top of the range on all sets suggests +5 lb", () => {
    const p = progression({ last: { date: "x", sets: [lb(35, 12), lb(35, 12), lb(35, 12)] }, target: parseDose("3x8-12"), unit: "lb", logType: "reps", loadable: true });
    expect(p.allTop).toBe(true);
    expect(p.nextWeight).toBe(40);
  });
  it("plan rule: 12, 12, 10 on 3x8-12 is not yet at the top", () => {
    const p = progression({ last: { date: "x", sets: [lb(35, 12), lb(35, 12), lb(35, 10)] }, target: parseDose("3x8-12"), unit: "lb", logType: "reps", loadable: true });
    expect(p.allTop).toBe(false);
    expect(p.nextWeight).toBe(35);
  });
  it("kg steps are 2.5", () => {
    const kg = (w: number, r: number): SetEntry => ({ weight: w, reps: r, seconds: null, unit: "kg" });
    const p = progression({ last: { date: "x", sets: [kg(20, 10), kg(20, 10)] }, target: null, unit: "kg", logType: "reps", loadable: true });
    expect(p.nextWeight).toBe(22.5);
  });
  it("exercise page tip after all sets at the top", () => {
    expect(nextTimeTip({ date: "x", sets: [lb(35, 10), lb(35, 10), lb(35, 10)] }, "lb")?.text).toBe(
      "Next time: 40 lb. You got 10 reps on all 3 sets today.",
    );
  });
});

describe("doses, names and labels", () => {
  it("parses plan doses", () => {
    expect(parseDose("3x8-12")).toEqual({ sets: 3, repsLo: 8, repsHi: 12, seconds: null });
    expect(parseDose("2x8 each leg")).toEqual({ sets: 2, repsLo: 8, repsHi: 8, seconds: null });
    expect(parseDose("3x30 sec")).toEqual({ sets: 3, repsLo: null, repsHi: null, seconds: 30 });
    expect(parseDose("20 min")).toEqual({ sets: 1, repsLo: null, repsHi: null, seconds: 1200 });
    expect(parseDose("2 sets, stop 2 reps short")).toMatchObject({ sets: 2, repsLo: null });
  });
  it("suggests a name from the main muscle", () => {
    expect(suggestWorkoutName([{ primary: ["shoulders"] }, { primary: ["shoulders", "triceps"] }, { primary: ["back"] }])).toBe("Shoulder day");
  });
  it("sets summary", () => {
    expect(setsShort([lb(35, 10), lb(35, 10), lb(35, 8)], "lb")).toBe("35 lb × 10, 10, 8");
  });
});

describe("video-only memory", () => {
  it("three video-only picks in a row skip the start screen", () => {
    let s = { streak: 0, everLogged: false };
    s = nextQuickPick(s, "video");
    s = nextQuickPick(s, "video");
    expect(skipsStartScreen(s)).toBe(false);
    s = nextQuickPick(s, "video");
    expect(skipsStartScreen(s)).toBe(true);
  });
  it("anyone who has logged a workout keeps the start screen", () => {
    let s = nextQuickPick({ streak: 0, everLogged: false }, "logged");
    for (let i = 0; i < 5; i++) s = nextQuickPick(s, "video");
    expect(skipsStartScreen(s)).toBe(false);
  });
});
