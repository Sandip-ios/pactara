import { describe, expect, it } from "vitest";
import { alreadyNudgedResult, nudgeDecision } from "../nudge-rules";
import { dayCovered, localDateIn } from "../streak-rules";

describe("nudging a groupmate", () => {
  it("allows the first nudge of the day when their day isn't covered", () => {
    expect(nudgeDecision({ firstName: "Guy", alreadyNudgedToday: false, targetCoveredToday: false })).toBeNull();
  });

  it("allows only one nudge per person per day", () => {
    expect(nudgeDecision({ firstName: "Guy", alreadyNudgedToday: true, targetCoveredToday: false })).toEqual({
      ok: false,
      reason: "already_nudged",
      message: "You already nudged Guy today",
    });
    expect(alreadyNudgedResult("Guy").message).toBe("You already nudged Guy today");
  });

  it("blocks a nudge when their day is already covered", () => {
    expect(nudgeDecision({ firstName: "Guy", alreadyNudgedToday: false, targetCoveredToday: true })).toEqual({
      ok: false,
      reason: "covered",
      message: "Guy's covered today",
    });
  });

  it("counts a check-in, rest or freeze row as covered", () => {
    expect(dayCovered("2026-11-22", new Set(["2026-11-22"]), new Set())).toBe(true);
    expect(dayCovered("2026-11-22", new Set(), new Set(["2026-11-22"]))).toBe(true);
    expect(dayCovered("2026-11-22", new Set(["2026-11-21"]), new Set(["2026-11-20"]))).toBe(false);
  });

  it("the once-a-day key uses the nudger's local date", () => {
    // Sun Nov 22, 11:30 PM in Chicago = Mon Nov 23 05:30 UTC.
    const lateSunday = new Date("2026-11-23T05:30:00Z");
    expect(localDateIn("America/Chicago", lateSunday)).toBe("2026-11-22");
    // Half an hour later it's a new day for the Chicago nudger.
    expect(localDateIn("America/Chicago", new Date("2026-11-23T06:00:00Z"))).toBe("2026-11-23");
  });
});
