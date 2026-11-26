import { describe, expect, it } from "vitest";
import { changeLabel, historyRows, nextTarget, progressStats, tipCard, weeksSpanned } from "@/lib/exercise-page";
import { repsFromTarget } from "@/lib/lift-rules";

const s = (weight: number, reps: number, isPr = false) => ({ weight, reps, seconds: null, unit: "lb" as const, isPr });
const sessions = [
  { date: "2026-11-23", sets: [s(135, 12, true), s(135, 12), s(135, 12)] },
  { date: "2026-11-16", sets: [s(125, 8), s(125, 8)] },
  { date: "2026-11-09", sets: [s(115, 8)] },
  { date: "2026-11-02", sets: [s(105, 8)] },
  { date: "2026-10-26", sets: [s(95, 8), s(95, 8)] },
];

describe("exercise progress", () => {
  it("weekly sessions over 4 weeks count as 5 weeks", () => expect(weeksSpanned("2026-10-26", "2026-11-23")).toBe(5));
  it("same day is 1 week", () => expect(weeksSpanned("2026-11-23", "2026-11-23")).toBe(1));
  it("95 → 135 over 5 weeks is +40 lb in 5 weeks", () => {
    const p = progressStats(sessions, "lb");
    expect(p.best).toBe(135);
    expect(p.change).toBe(40);
    expect(p.weeks).toBe(5);
    expect(p.sessions).toBe(5);
    expect(changeLabel(p.change!, "lb")).toBe("+40 lb");
  });
  it("one session has no change", () => expect(progressStats([sessions[0]!], "lb").change).toBeNull());
  it("12 on every set → next time 140 lb for 8", () =>
    expect(nextTarget(sessions[0]!, "lb", { logType: "reps", loadable: true })).toEqual({ weight: 140, reps: 8, text: "Next time, try 140 lb for 8." }));
  it("short of 12 → same weight for 12", () =>
    expect(nextTarget(sessions[1]!, "lb", { logType: "reps", loadable: true })?.text).toBe("Next time, try 125 lb for 12."));
  it("history is newest first with sets and PR", () => {
    const rows = historyRows([...sessions].reverse(), "lb", false);
    expect(rows[0]).toMatchObject({ date: "Nov 23", weekday: "Mon", sets: "135 × 12 · 135 × 12 · 135 × 12", pr: true });
    expect(rows[1]!.pr).toBe(false);
    expect(rows).toHaveLength(5);
  });
});

describe("tip card", () => {
  it("member tip reads with sets × reps", () =>
    expect(tipCard({ authorKind: "member", authorName: "Maya Lindqvist", workoutName: "Back day", tip: "Pull to your belly button and pause for 1 second", sets: 4, reps: "8" })).toEqual({
      lead: "Maya's tip in Back day:",
      body: "pull to your belly button and pause for 1 second. 4 sets of 8.",
    }));
  it("own tip says Your", () => expect(tipCard({ authorKind: "you", authorName: "you", workoutName: "Legs", tip: "Slow down.", sets: 3, reps: "10 each" })?.lead).toBe("Your tip in Legs:"));
  it("no tip, no card", () => expect(tipCard({ authorKind: "member", authorName: "Maya", workoutName: "Back day", tip: "  ", sets: 4, reps: "8" })).toBeNull());
});

describe("logger reps prefill from workout target", () => {
  it("12 → 12", () => expect(repsFromTarget("12")).toBe(12));
  it("8-12 → 8", () => expect(repsFromTarget("8-12")).toBe(8));
  it("10 each → 10", () => expect(repsFromTarget("10 each")).toBe(10));
  it("no target → null", () => expect(repsFromTarget("")).toBeNull());
});
