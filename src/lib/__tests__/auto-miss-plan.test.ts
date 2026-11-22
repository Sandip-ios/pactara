import { describe, expect, it } from "vitest";
import { key, planAutoMiss, type PlanMembership } from "../auto-miss-plan";

const fiveDays: PlanMembership = {
  userId: "u1",
  groupId: "g1",
  joinedAt: "2026-11-01T12:00:00Z",
  timezone: "America/Chicago",
  group: { frequency: "specific", days_per_week: 5 },
};

// Thu Nov 19 2026, 01:30 in Chicago → Wednesday Nov 18 just closed.
const now = new Date("2026-11-19T07:30:00Z");

function run(restDates: string[], extra: Partial<Parameters<typeof planAutoMiss>[0]> = {}) {
  return planAutoMiss({
    memberships: [fiveDays],
    now,
    checkIns: new Set(),
    protectedDays: new Set(restDates.map((d) => key("u1", "g1", d))),
    restDates: new Map([[key("u1", "g1"), new Set(restDates)]]),
    posts: new Map(),
    ...extra,
  });
}

describe("auto-miss job", () => {
  it("takes a rest day automatically when one is left this week", () => {
    const plan = run(["2026-11-16"]);
    expect(plan.rests).toEqual([{ user_id: "u1", group_id: "g1", freeze_date: "2026-11-18", kind: "rest" }]);
    expect(plan.postInserts).toEqual([
      { user_id: "u1", group_id: "g1", local_date: "2026-11-18", check_in_missed: false },
    ]);
  });

  it("marks the day missed once this week's rest days are used up", () => {
    const plan = run(["2026-11-16", "2026-11-17"]);
    expect(plan.rests).toEqual([]);
    expect(plan.postInserts).toEqual([
      { user_id: "u1", group_id: "g1", local_date: "2026-11-18", check_in_missed: true },
    ]);
  });

  it("does not count last week's rest days against this week", () => {
    const plan = run(["2026-11-14", "2026-11-15"]);
    expect(plan.rests.map((r) => r.freeze_date)).toEqual(["2026-11-18"]);
  });

  it("leaves a day with a check-in alone", () => {
    const plan = run([], { checkIns: new Set([key("u1", "g1", "2026-11-18")]) });
    expect(plan).toEqual({ rests: [], postInserts: [], missedIds: [], unmissIds: [] });
  });

  it("flags an existing empty post as missed when no rest is left", () => {
    const plan = run(["2026-11-16", "2026-11-17"], {
      posts: new Map([[key("u1", "g1", "2026-11-18"), { id: "p1", checkInId: null, missed: false }]]),
    });
    expect(plan.missedIds).toEqual(["p1"]);
  });
});
