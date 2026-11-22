import { describe, expect, it } from "vitest";
import { celebrationCounts, crewPageCanNudge, crewPageCounts, crewPageStatus, crewWaiting, restingOn } from "../group-today-view";

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

describe("Groups list: resting today", () => {
  it("leaves a resting member out of '{n} of {m} showed up' and out of the people still to go", () => {
    const members = [m("done"), m("not_committed"), m("not_committed", true)];
    expect(crewPageCounts(members)).toEqual({ done: 1, due: 2 });
    expect(crewWaiting(members)).toHaveLength(1);
    expect(crewPageStatus(members[2]!)).toBe("rest");
  });
  it("a resting member whose day differs from yours is still resting, never 'Not checked in yet' + Nudge", () => {
    // You're on Nov 23 already; Bertille (behind you) is still on Nov 22 with a rest row.
    const covered = new Set(["2026-11-22"]);
    expect(restingOn("2026-11-22", new Set(), covered)).toBe(true);
    const status = crewPageStatus(m("not_committed", true));
    expect(status).toBe("rest");
    expect(crewPageCanNudge(status, false)).toBe(false);
  });
  it("a rest row on another date doesn't make today a rest day, and a check-in beats the rest row", () => {
    expect(restingOn("2026-11-23", new Set(), new Set(["2026-11-22"]))).toBe(false);
    expect(restingOn("2026-11-22", new Set(["2026-11-22"]), new Set(["2026-11-22"]))).toBe(false);
  });
});

describe("check-in celebration: resting teammates", () => {
  it("leaves resting teammates out of '{n} of {m} teammates checked in today'", () => {
    // You checked in, Guy not yet, Bertille resting → 1 of 2.
    expect(
      celebrationCounts([
        { checkedIn: true, resting: false },
        { checkedIn: false, resting: false },
        { checkedIn: false, resting: true },
      ]),
    ).toEqual({ done: 1, due: 2 });
  });
});
