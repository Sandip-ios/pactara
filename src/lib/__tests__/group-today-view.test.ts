import { describe, expect, it } from "vitest";
import { celebrationCounts, crewPageCanNudge, crewPageCounts, crewPageStatus, crewWaiting, memberOwnToday, restingOn } from "../group-today-view";
import { crewTodayStatus } from "../crew-today";

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

describe("teammate already on tomorrow: judged only by their own today", () => {
  // Viewer in Chicago is on Sun Nov 22; Kai in Auckland is already on Mon Nov 23.
  const kaiToday = "2026-11-23";
  const base = { ownToday: kaiToday, workingOut: false };

  it("a rest row on the viewer's today never makes them 'Already checked in'", () => {
    const r = memberOwnToday({ ...base, checkInDates: new Set(), coveredDates: new Set(["2026-11-22"]) });
    expect(r).toEqual({ status: "not_committed", resting: false });
    const status = crewPageStatus({ ...r, workoutSessionId: null });
    expect(status).toBe("not_committed");
    expect(crewPageCanNudge(status, false)).toBe(true);
    expect(crewPageCounts([{ ...r, workoutSessionId: null }])).toEqual({ done: 0, due: 1 });
  });

  it("a check-in on the viewer's today doesn't count on their new day", () => {
    const r = memberOwnToday({ ...base, checkInDates: new Set(["2026-11-22"]), coveredDates: new Set() });
    expect(r.status).toBe("not_committed");
  });

  it("checked in on their own today → done", () => {
    const r = memberOwnToday({ ...base, checkInDates: new Set([kaiToday]), coveredDates: new Set([kaiToday]) });
    expect(r).toEqual({ status: "done", resting: false });
    expect(crewPageCounts([{ ...r, workoutSessionId: null }])).toEqual({ done: 1, due: 1 });
  });

  it("rest/freeze row on their own today → 'Resting today', not due, not nudgeable", () => {
    const r = memberOwnToday({ ...base, checkInDates: new Set(), coveredDates: new Set([kaiToday]) });
    const status = crewPageStatus({ ...r, workoutSessionId: null });
    expect(status).toBe("rest");
    expect(crewPageCanNudge(status, false)).toBe(false);
    expect(crewPageCounts([{ ...r, workoutSessionId: null }])).toEqual({ done: 0, due: 0 });
  });

  it("matches Home's Crew today status for the same member", () => {
    const covered = new Set([kaiToday]);
    expect(crewTodayStatus({ today: kaiToday, checkIns: new Set(), covered, missed: new Set(), workingOut: false })).toBe("rest");
    expect(memberOwnToday({ ...base, checkInDates: new Set(), coveredDates: covered }).resting).toBe(true);
  });
});

describe("check-in celebration: teammates judged by their own today", () => {
  // You (Chicago) just checked in on Sun Nov 22; Kai, Lena and Mia are already on Mon Nov 23.
  const own = (checkIns: string[], covered: string[]) => {
    const r = memberOwnToday({ ownToday: "2026-11-23", checkInDates: new Set(checkIns), coveredDates: new Set(covered), workingOut: false });
    return { checkedIn: r.status === "done", resting: r.resting };
  };

  it("a check-in or rest row on your today doesn't count for a teammate already on tomorrow", () => {
    expect(own(["2026-11-22"], [])).toEqual({ checkedIn: false, resting: false });
    expect(own([], ["2026-11-22"])).toEqual({ checkedIn: false, resting: false });
  });

  it("counts their own today: checked in → in, rest row → resting and not due", () => {
    const you = { checkedIn: true, resting: false };
    const kai = own([], ["2026-11-22"]);
    const lena = own([], ["2026-11-23"]);
    const mia = own(["2026-11-23"], []);
    expect(lena).toEqual({ checkedIn: false, resting: true });
    expect(mia).toEqual({ checkedIn: true, resting: false });
    expect(celebrationCounts([you, kai, lena, mia])).toEqual({ done: 2, due: 3 });
  });
});
