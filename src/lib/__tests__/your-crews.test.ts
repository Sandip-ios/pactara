import { describe, expect, it } from "vitest";
import { crewsStillToShowUp, inTodayLine, inviteIdFromInput } from "../your-crews";
import { crewRuleLabel } from "../streak-rules";
import { crewOptionsSubtitle } from "@/components/groups/GroupOverflowMenu";

const m = (userId: string, status: "done" | "not_committed" | "missed", resting = false) => ({
  userId,
  status,
  resting,
  workoutSessionId: null,
});

describe("crew rule label (crew cards said 'Daily' for a 5-a-week crew)", () => {
  it("a crew set to 5 days a week shows 5 check-ins a week", () => {
    expect(crewRuleLabel({ frequency: "specific", days_per_week: 5 })).toBe("5 check-ins a week");
  });
  it("a daily crew shows its real target: 5 check-ins a week (2 automatic rest days)", () => {
    expect(crewRuleLabel({ frequency: "daily", days_per_week: 7 })).toBe("5 check-ins a week");
  });
  it("one day a week is singular", () => {
    expect(crewRuleLabel({ frequency: "specific", days_per_week: 1 })).toBe("1 check-in a week");
  });
  it("the ••• header reads members · rule", () => {
    expect(crewOptionsSubtitle({ memberCount: 4, frequency: "specific", daysPerWeek: 5 })).toBe("4 members · 5 check-ins a week");
    expect(crewOptionsSubtitle({ memberCount: 1, frequency: "specific", daysPerWeek: 3 })).toBe("1 member · 3 check-ins a week");
  });
});

describe("Your crews sheet", () => {
  it("counts each person still to show up once across crews and skips resting members", () => {
    const fitFam = { members: [m("you", "done"), m("guy", "not_committed"), m("bea", "not_committed", true)] };
    const runClub = { members: [m("guy", "not_committed"), m("ana", "missed")] };
    expect(crewsStillToShowUp([fitFam, runClub])).toBe(2);
  });
  it("is 0 when everyone due is in", () => {
    expect(crewsStillToShowUp([{ members: [m("you", "done"), m("bea", "not_committed", true)] }])).toBe(0);
  });
  it("row line reads '0 of 4 in today'", () => {
    expect(inTodayLine({ done: 0, due: 4 })).toBe("0 of 4 in today");
  });
  it("Join with a link accepts a full invite link or a bare code", () => {
    const id = "3f2a9c1e-1b2c-4d5e-8f90-123456789abc";
    expect(inviteIdFromInput(`https://pactara.lovable.app/join/${id}?ref=x`)).toBe(id);
    expect(inviteIdFromInput(`  ${id} `)).toBe(id);
    expect(inviteIdFromInput("")).toBeNull();
    expect(inviteIdFromInput("not a link!")).toBeNull();
  });
});
