import { describe, expect, it } from "vitest";
import {
  atRiskGroups,
  eveningReminderGroups,
  eveningReminderMessage,
  groupsNeedingCheckIn,
  morningReminderGroups,
  morningReminderMessage,
  streakRiskMessage,
  type RiskGroupInput,
} from "../streak-risk-plan";

// Saturday Nov 21 2026, 9 PM in Chicago (= Nov 22 03:00 UTC). Week = Nov 16–22.
const nineChicago = new Date("2026-11-22T03:00:00Z");
const TZ = "America/Chicago";

const daily = { frequency: "daily", days_per_week: 7 };
const group = (over: Partial<RiskGroupInput>): RiskGroupInput => ({
  groupId: "g1",
  name: "Fit Uxers",
  schedule: daily,
  checkIns: new Set(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]),
  rests: new Set(),
  freezes: new Set(),
  ...over,
});

describe("streak at risk (9 PM)", () => {
  it("is not at risk while a rest day is still left this week", () => {
    // Daily group, 1 of 2 rest days used (Fri), no check-in yet Saturday.
    const g = group({ rests: new Set(["2026-11-20"]) });
    expect(atRiskGroups(TZ, [g], nineChicago)).toEqual([]);
  });

  it("is at risk once this week's rest days are used up and no check-in today", () => {
    const g = group({
      checkIns: new Set(["2026-11-16", "2026-11-17", "2026-11-18"]),
      rests: new Set(["2026-11-19", "2026-11-20"]),
    });
    expect(atRiskGroups(TZ, [g], nineChicago)).toEqual([{ groupId: "g1", name: "Fit Uxers", streak: 5 }]);
  });

  it("is not at risk after checking in today for that group", () => {
    const g = group({
      checkIns: new Set(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-21"]),
      rests: new Set(["2026-11-19", "2026-11-20"]),
    });
    expect(atRiskGroups(TZ, [g], nineChicago)).toEqual([]);
  });

  it("uses the member's local date, not UTC (UTC is already Sunday)", () => {
    // Checked in Saturday local; in UTC it is Sunday Nov 22 with no check-in.
    const g = group({
      checkIns: new Set(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-21"]),
      rests: new Set(["2026-11-19", "2026-11-20"]),
    });
    expect(atRiskGroups("UTC", [g], nineChicago).length).toBe(1);
    expect(atRiskGroups(TZ, [g], nineChicago)).toEqual([]);
  });

  it("judges each group on its own", () => {
    const outOfRest = group({
      groupId: "a",
      name: "Fit Uxers",
      checkIns: new Set(["2026-11-16", "2026-11-17", "2026-11-18"]),
      rests: new Set(["2026-11-19", "2026-11-20"]),
    });
    // 3-days-a-week group: 4 rest days, only 2 used → still safe.
    const threeDay = group({
      groupId: "b",
      name: "Prim + Jose",
      schedule: { frequency: "specific", days_per_week: 3 },
      checkIns: new Set(["2026-11-16", "2026-11-18", "2026-11-19"]),
      rests: new Set(["2026-11-17", "2026-11-20"]),
    });
    // Checked in today in a third group: doesn't make the first one safe.
    const checkedToday = group({ groupId: "c", name: "Busi + Jose", checkIns: new Set(["2026-11-21"]) });
    expect(atRiskGroups(TZ, [outOfRest, threeDay, checkedToday], nineChicago).map((g) => g.groupId)).toEqual(["a"]);
  });

  it("ignores last week's rest days", () => {
    const g = group({ rests: new Set(["2026-11-14", "2026-11-15"]) });
    expect(atRiskGroups(TZ, [g], nineChicago)).toEqual([]);
  });

  it("names every group at risk in one push", () => {
    const msg = streakRiskMessage(
      [
        { groupId: "a", name: "Fit Uxers", streak: 5 },
        { groupId: "b", name: "Prim + Jose", streak: 3 },
      ],
      false,
    );
    expect(msg.title).toContain("2 streaks");
    expect(msg.body).toContain("Fit Uxers and Prim + Jose");
  });

  it("tells people with a freeze to use it tomorrow (freezes protect yesterday)", () => {
    const one = streakRiskMessage([{ groupId: "a", name: "Fit Uxers", streak: 5 }], true);
    expect(one.body).toContain("Check in before midnight, or use a streak freeze tomorrow to protect it.");
    const many = streakRiskMessage(
      [
        { groupId: "a", name: "Fit Uxers", streak: 5 },
        { groupId: "b", name: "Prim + Jose", streak: 3 },
      ],
      true,
    );
    expect(many.body).toContain("Check in before midnight, or use a streak freeze tomorrow to protect them.");
  });

  it("links a single at-risk group straight to its check-in", () => {
    const msg = streakRiskMessage([{ groupId: "a", name: "Fit Uxers", streak: 5 }], false);
    expect(msg.title).toContain("Fit Uxers");
    expect(msg.url).toBe("/check-in?group=a");
  });
});

describe("5 PM and 8 PM check-in reminders", () => {
  // Saturday Nov 21 2026, 8 PM in Chicago (= Nov 22 02:00 UTC). Week = Nov 16–22.
  const eightChicago = new Date("2026-11-22T02:00:00Z");
  const outOfRest = group({
    groupId: "a",
    name: "Fit Uxers",
    checkIns: new Set(["2026-11-16", "2026-11-17", "2026-11-18"]),
    rests: new Set(["2026-11-19", "2026-11-20"]),
  });

  it("skips a group while a rest day is still left this week", () => {
    const g = group({ rests: new Set(["2026-11-20"]) });
    expect(groupsNeedingCheckIn(TZ, [g], eightChicago)).toEqual([]);
  });

  it("skips a group already covered today by a check-in, rest or freeze row", () => {
    const checked = { ...outOfRest, checkIns: new Set([...outOfRest.checkIns, "2026-11-21"]) };
    const frozen = { ...outOfRest, freezes: new Set(["2026-11-21"]) };
    expect(groupsNeedingCheckIn(TZ, [checked], eightChicago)).toEqual([]);
    expect(groupsNeedingCheckIn(TZ, [frozen], eightChicago)).toEqual([]);
  });

  it("reminds about a group with no rest days left and nothing logged today, even with no streak", () => {
    const noStreak = { ...outOfRest, checkIns: new Set<string>() };
    expect(groupsNeedingCheckIn(TZ, [noStreak], eightChicago).map((g) => g.groupId)).toEqual(["a"]);
  });

  it("judges each group on its own and names them all in one push", () => {
    const second = { ...outOfRest, groupId: "b", name: "Prim + Jose" };
    const safe = group({ groupId: "c", name: "Busi + Jose", checkIns: new Set(["2026-11-21"]) });
    const need = groupsNeedingCheckIn(TZ, [outOfRest, safe, second], eightChicago);
    expect(need.map((g) => g.groupId)).toEqual(["a", "b"]);
    const msg = eveningReminderMessage(20, need);
    expect(msg.title).toBe("Last call to check in 🌙");
    expect(msg.body).toContain("Fit Uxers and Prim + Jose");
    expect(msg.url).toBe("/check-in");
  });

  it("names a single group and opens its check-in", () => {
    const msg = eveningReminderMessage(17, [{ groupId: "a", name: "Fit Uxers" }]);
    expect(msg.title).toBe("Still time to check in ⏳");
    expect(msg.body).toContain("Fit Uxers");
    expect(msg.url).toBe("/check-in?group=a");
  });
});

describe("8 PM reminder steps aside for the 9 PM streak warning", () => {
  const eightChicago = new Date("2026-11-22T02:00:00Z"); // Sat Nov 21, 8 PM Chicago
  // No rest days left, nothing today, 3-day streak → 9 PM will warn.
  const withStreak = group({
    groupId: "a",
    name: "Fit Uxers",
    checkIns: new Set(["2026-11-16", "2026-11-17", "2026-11-18"]),
    rests: new Set(["2026-11-19", "2026-11-20"]),
  });
  // No rest days left, nothing today, no streak (missed yesterday) → 9 PM won't warn.
  const noStreak = group({
    groupId: "b",
    name: "Prim + Jose",
    checkIns: new Set(["2026-11-16"]),
    rests: new Set(["2026-11-17", "2026-11-18"]),
  });

  it("skips the 8 PM push when every group will get the 9 PM warning", () => {
    expect(eveningReminderGroups(20, TZ, [withStreak], eightChicago)).toEqual([]);
    expect(atRiskGroups(TZ, [withStreak], new Date("2026-11-22T03:00:00Z")).length).toBe(1);
  });

  it("still names groups the 9 PM push won't cover, with the no-streak wording", () => {
    const groups = eveningReminderGroups(20, TZ, [withStreak, noStreak], eightChicago);
    expect(groups.map((g) => g.groupId)).toEqual(["b"]);
    const msg = eveningReminderMessage(20, groups);
    expect(msg.title).toBe("Last call to check in 🌙");
    expect(msg.body).toBe("Check in for Prim + Jose before bed.");
  });

  it("a 1-day streak counts as no streak", () => {
    const oneDay = { ...noStreak, checkIns: new Set(["2026-11-16", "2026-11-20"]) };
    const groups = eveningReminderGroups(20, TZ, [oneDay], eightChicago);
    expect(groups).toEqual([{ groupId: "b", name: "Prim + Jose", streak: 1 }]);
    expect(eveningReminderMessage(20, groups).body).toBe("Check in for Prim + Jose before bed.");
  });

  it("keeps 'Don't break your streak' when a named group has a streak", () => {
    expect(eveningReminderMessage(20, [{ groupId: "a", name: "Fit Uxers", streak: 3 }]).body).toBe(
      "Don't break your streak in Fit Uxers — check in before bed.",
    );
  });

  it("5 PM is unchanged: it still names groups with a streak", () => {
    expect(eveningReminderGroups(17, TZ, [withStreak], eightChicago).map((g) => g.groupId)).toEqual(["a"]);
  });
});

describe("morning check-in reminder", () => {
  const nineAmChicago = new Date("2026-11-21T15:00:00Z"); // Sat Nov 21, 9 AM Chicago

  it("skips groups already covered today and ignores rest days left", () => {
    const restLeft = group({ groupId: "a", name: "Fit Uxers", rests: new Set(["2026-11-20"]) }); // 1 rest left
    const checked = group({ groupId: "b", name: "Prim + Jose", checkIns: new Set(["2026-11-21"]) });
    const rested = group({ groupId: "c", name: "Busi + Jose", rests: new Set(["2026-11-21"]) });
    const frozen = group({ groupId: "d", name: "Crew", freezes: new Set(["2026-11-21"]) });
    expect(
      morningReminderGroups(TZ, [restLeft, checked, rested, frozen], nineAmChicago).map((g) => g.groupId),
    ).toEqual(["a"]);
  });

  it("a check-in in one group doesn't silence the reminder for another", () => {
    const checked = group({ groupId: "b", name: "Prim + Jose", checkIns: new Set(["2026-11-21"]) });
    const other = group({ groupId: "a", name: "Fit Uxers", checkIns: new Set() });
    expect(morningReminderGroups(TZ, [checked, other], nineAmChicago).map((g) => g.groupId)).toEqual(["a"]);
  });

  it("names several groups in one push", () => {
    const msg = morningReminderMessage([
      { groupId: "a", name: "Fit Uxers" },
      { groupId: "b", name: "Prim + Jose" },
    ]);
    expect(msg.title).toBe("Time to check in ✅");
    expect(msg.body).toContain("Fit Uxers and Prim + Jose");
    expect(msg.url).toBe("/check-in");
  });

  it("keeps the 'Day X of Y' wording for a single group", () => {
    const msg = morningReminderMessage([{ groupId: "a", name: "Fit Uxers", day: 12, total: 30 }]);
    expect(msg.body).toBe("Day 12 of 30 in Fit Uxers — keep it going. 🔥");
    expect(msg.url).toBe("/check-in?group=a");
  });
});

describe("missed check-in cards show the day", () => {
  it("uses the member's own local dates", async () => {
    const { missedDayLabel } = await import("../streak-rules");
    expect(missedDayLabel("2026-11-21", "2026-11-22")).toBe("Yesterday");
    expect(missedDayLabel("2026-11-17", "2026-11-22")).toBe("Tuesday");
    expect(missedDayLabel("2026-11-03", "2026-11-22")).toBe("Nov 3");
    expect(missedDayLabel("2026-11-22", "2026-11-22")).toBe("Today");
  });

  it("writes the sentence with the same day", async () => {
    const { missedDaySentence } = await import("../streak-rules");
    expect(missedDaySentence("2026-11-21", "2026-11-22")).toBe(
      "Your group missed you yesterday.",
    );
    expect(missedDaySentence("2026-11-17", "2026-11-22")).toBe(
      "Your group missed you Tuesday.",
    );
    expect(missedDaySentence("2026-11-03", "2026-11-22")).toBe(
      "Your group missed you on Nov 3.",
    );
    expect(missedDaySentence("2026-11-22", "2026-11-22")).toBe(
      "Your group missed you today.",
    );
  });
});
