import { describe, expect, it } from "vitest";
import { crewPageCanNudge, crewPageCounts, crewPageStatus } from "../group-today-view";

const m = (status: "done" | "not_committed" | "missed", resting = false, workoutSessionId: string | null = null) => ({
  status,
  resting,
  workoutSessionId,
});

describe("crew page Today tab: resting today", () => {
  it("shows a member covered by a rest or freeze row as resting, not checked in", () => {
    // The server still reports the covered day as "done"; resting wins.
    expect(crewPageStatus(m("done", true))).toBe("rest");
  });
  it("can't nudge a resting member", () => {
    expect(crewPageCanNudge("rest", false)).toBe(false);
    expect(crewPageCanNudge("not_committed", false)).toBe(true);
  });
  it("leaves resting members out of '{n} of {m} completed today'", () => {
    // Jose checked in, Guy not yet, Bertille resting → 1 of 2.
    expect(crewPageCounts([m("done"), m("not_committed"), m("done", true)])).toEqual({ done: 1, due: 2 });
  });
  it("a live workout still shows over a rest day, like Home", () => {
    expect(crewPageStatus(m("done", true, "w1"))).toBe("working_out");
  });
});
