import { describe, expect, it } from "vitest";
import {
  crewDueToday,
  crewMemberWeek,
  crewTodayStatus,
  orderCrew,
  streakChipLabel,
  todayCheckedInSubtitle,
  todayHeadline,
  weekDotsLabel,
  weekFooterNote,
  type MemberDayInputs,
} from "../crew-today";
import { localDateIn } from "../streak-rules";

const daily = { frequency: "daily", days_per_week: 7 };
const fiveDays = { frequency: "weekly", days_per_week: 5 };

function inputs(partial: Partial<MemberDayInputs> & { today: string }): MemberDayInputs {
  return {
    checkIns: new Set(),
    covered: new Set(),
    missed: new Set(),
    workingOut: false,
    ...partial,
  };
}

describe("member today status", () => {
  const today = "2026-11-22"; // Sunday

  it("is done when there is a check-in today, even with a live workout", () => {
    expect(crewTodayStatus(inputs({ today, checkIns: new Set([today]), workingOut: true }))).toBe("done");
  });

  it("is working out when a live session runs and nothing is logged", () => {
    expect(crewTodayStatus(inputs({ today, workingOut: true }))).toBe("working_out");
  });

  it("is rest when a rest or freeze row covers today", () => {
    expect(crewTodayStatus(inputs({ today, covered: new Set([today]) }))).toBe("rest");
  });

  it("is not yet otherwise, and yesterday's check-in doesn't count", () => {
    expect(crewTodayStatus(inputs({ today, checkIns: new Set(["2026-11-21"]) }))).toBe("not_yet");
  });

  it("uses the member's own date: 7 pm Sunday in Chicago is still Sunday", () => {
    const now = new Date("2026-11-23T01:00:00Z"); // Mon 01:00 UTC
    const chicagoToday = localDateIn("America/Chicago", now);
    expect(chicagoToday).toBe("2026-11-22");
    const status = crewTodayStatus(inputs({ today: chicagoToday, checkIns: new Set(["2026-11-22"]) }));
    expect(status).toBe("done");
    // The same check-in is "yesterday" for someone already on Monday in UTC.
    expect(crewTodayStatus(inputs({ today: localDateIn("UTC", now), checkIns: new Set(["2026-11-22"]) }))).toBe(
      "not_yet",
    );
  });
});

describe("member week data", () => {
  it("returns Monday → Sunday with checked, rest, missed and empty days", () => {
    const week = crewMemberWeek(
      inputs({
        today: "2026-11-20", // Friday
        checkIns: new Set(["2026-11-16", "2026-11-18", "2026-11-20", "2026-11-15"]),
        covered: new Set(["2026-11-17"]),
        missed: new Set(["2026-11-19"]),
      }),
      daily,
    );
    expect(week.days.map((d) => d.date)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(week.days.map((d) => d.state)).toEqual(["checked", "rest", "checked", "missed", "checked", "none", "none"]);
    // Last Sunday's check-in (Nov 15) belongs to the previous week.
    expect(week.workouts).toBe(3);
    expect(week.restDays).toBe(1);
    expect(week.missedDays).toBe(1);
  });

  it("uses the group's weekly target: 5 for daily groups, days_per_week otherwise", () => {
    expect(crewMemberWeek(inputs({ today: "2026-11-20" }), daily).target).toBe(5);
    expect(crewMemberWeek(inputs({ today: "2026-11-20" }), fiveDays).target).toBe(5);
    expect(crewMemberWeek(inputs({ today: "2026-11-20" }), { frequency: "weekly", days_per_week: 3 }).target).toBe(3);
  });

  it("starts a new week on the member's own Monday", () => {
    const now = new Date("2026-11-23T03:00:00Z"); // Mon in UTC, still Sun in New York
    const ny = crewMemberWeek(
      inputs({ today: localDateIn("America/New_York", now), checkIns: new Set(["2026-11-16", "2026-11-22"]) }),
      daily,
    );
    expect(ny.days[0]?.date).toBe("2026-11-16");
    expect(ny.workouts).toBe(2);
    const utc = crewMemberWeek(
      inputs({ today: localDateIn("UTC", now), checkIns: new Set(["2026-11-16", "2026-11-22"]) }),
      daily,
    );
    expect(utc.days[0]?.date).toBe("2026-11-23");
    expect(utc.workouts).toBe(0);
  });

  it("describes the dots for screen readers", () => {
    expect(weekDotsLabel(5, 1)).toBe("5 check-ins and 1 rest day this week");
    expect(weekDotsLabel(1, 0)).toBe("1 check-in and 0 rest days this week");
    expect(weekDotsLabel(2, 1, 1)).toBe("2 check-ins and 1 rest day this week, 1 missed");
  });
});

describe("crew order and copy", () => {
  it("puts you first, then members not yet in, then the rest in roster order", () => {
    const ordered = orderCrew([
      { id: "a", isYou: false, status: "done" as const },
      { id: "b", isYou: false, status: "not_yet" as const },
      { id: "me", isYou: true, status: "done" as const },
      { id: "c", isYou: false, status: "rest" as const },
      { id: "d", isYou: false, status: "not_yet" as const },
    ]);
    expect(ordered.map((m) => m.id)).toEqual(["me", "b", "d", "c", "a"]);
  });

  it("writes the Today headline from who is in", () => {
    expect(todayHeadline({ inCount: 0, dueCount: 4, solo: false, checkedIn: false })).toBe("Be the first one in today.");
    expect(todayHeadline({ inCount: 2, dueCount: 4, solo: false, checkedIn: false })).toBe(
      "2 of 4 are in. Don't be the one.",
    );
    expect(todayHeadline({ inCount: 0, dueCount: 1, solo: true, checkedIn: false })).toBe(
      "Check in with proof and keep your streak alive.",
    );
    expect(todayHeadline({ inCount: 3, dueCount: 4, solo: false, checkedIn: true })).toBe("You're in for today.");
  });

  it("leaves members resting today out of the due count", () => {
    expect(crewDueToday(["done", "not_yet", "rest", "not_yet"])).toBe(3);
    expect(crewDueToday(["working_out", "rest", "rest"])).toBe(1);
    expect(crewDueToday(["done", "done"])).toBe(2);
  });

  it("uses the due count in the headline: 1 in, 1 resting, 4-person crew -> 1 of 3", () => {
    const dueCount = crewDueToday(["not_yet", "done", "rest", "not_yet"]);
    expect(todayHeadline({ inCount: 1, dueCount, solo: false, checkedIn: false })).toBe("1 of 3 are in. Don't be the one.");
    expect(todayCheckedInSubtitle({ inCount: 2, dueCount, solo: false })).toBe("2 of 3 in so far.");
  });

  it("says Be the first one in when nobody due is in yet, even with someone resting", () => {
    const dueCount = crewDueToday(["not_yet", "rest", "not_yet"]);
    expect(todayHeadline({ inCount: 0, dueCount, solo: false, checkedIn: false })).toBe("Be the first one in today.");
  });

  it("says You're the only one due today when everyone else is resting", () => {
    const dueCount = crewDueToday(["not_yet", "rest", "rest", "rest"]);
    expect(dueCount).toBe(1);
    expect(todayHeadline({ inCount: 0, dueCount, solo: false, checkedIn: false })).toBe("You're the only one due today.");
    expect(todayCheckedInSubtitle({ inCount: 1, dueCount: crewDueToday(["done", "rest"]), solo: false })).toBe(
      "You're the only one due today.",
    );
  });

  it("shows rest days left, goal hit or over goal in the footer", () => {
    expect(weekFooterNote({ workouts: 3, target: 5, restLeft: 2 })).toEqual({ text: "2 rest days left", tone: "muted" });
    expect(weekFooterNote({ workouts: 3, target: 5, restLeft: 1 })).toEqual({ text: "1 rest day left", tone: "muted" });
    expect(weekFooterNote({ workouts: 5, target: 5, restLeft: 2 })).toEqual({ text: "Goal hit", tone: "muted" });
    expect(weekFooterNote({ workouts: 6, target: 5, restLeft: 1 })).toEqual({ text: "Over goal", tone: "green" });
  });

  it("labels the streak chip", () => {
    expect(streakChipLabel(0, false)).toBe("Crew streak: Start today");
    expect(streakChipLabel(1, false)).toBe("Crew streak: 1 day");
    expect(streakChipLabel(12, false)).toBe("Crew streak: 12 days");
    expect(streakChipLabel(4, true)).toBe("Your streak: 4 days");
  });
});
