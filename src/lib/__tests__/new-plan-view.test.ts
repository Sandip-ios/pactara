import { describe, expect, it } from "vitest";
import {
  daysPickedLine, defaultTrainingDays, nextMondayIso, longDate, planSocialLine, repeatNote,
  showPlanCount, thisWeekCells, todayCard, visibleWeekCount, weekRows,
} from "../new-plan-view";

describe("start sheet days", () => {
  it("preselects Mon-first days", () => {
    expect(defaultTrainingDays(5)).toEqual([0, 1, 2, 3, 4]);
    expect(defaultTrainingDays(4)).toEqual([0, 1, 3, 4]);
    expect(defaultTrainingDays(3)).toEqual([0, 2, 4]);
  });
  it("blocks a count that doesn't match the plan", () => {
    expect(daysPickedLine(5, 5)).toEqual({ ok: true, text: "5 days picked. Your other days are rest days and keep your streak going." });
    expect(daysPickedLine(4, 5)).toEqual({ ok: false, text: "This plan has 5 workouts a week. Pick 5." });
  });
  it("names next Monday", () => {
    expect(longDate(nextMondayIso("2026-11-26"))).toBe("Monday, Nov 30");
    expect(nextMondayIso("2026-11-30")).toBe("2026-12-07");
  });
});

describe("this week", () => {
  const base = { today: "2026-11-26", trainingDays: [0, 1, 2, 3, 4], doneDates: ["2026-11-23", "2026-11-25"] };
  it("marks done, missed, today, upcoming and rest", () => {
    expect(thisWeekCells(base).map((c) => c.state)).toEqual(["done", "missed", "done", "today", "upcoming", "rest", "rest"]);
  });
  it("paused shows today as a plain training day", () => {
    expect(thisWeekCells({ ...base, paused: true })[3]!.state).toBe("upcoming");
  });
  it("days before the start date are their own state", () => {
    expect(thisWeekCells({ ...base, doneDates: [], startsOn: "2026-11-25" }).map((c) => c.state).slice(0, 3)).toEqual(["before", "before", "missed"]);
  });
});

describe("week rows", () => {
  const rows = weekRows({ weeks: 8, currentWeek: 2, perWeek: 5, doneByWeek: new Map([[1, 5], [2, 2]]), today: "2026-11-26", futureNote: () => null });
  it("labels done, current and future weeks", () => {
    expect(rows[0]).toEqual({ week: 1, status: "done", sub: "5 of 5 workouts", right: "Done" });
    expect(rows[1]).toEqual({ week: 2, status: "current", sub: "2 of 5 workouts", right: "In progress" });
    expect(rows[2]).toEqual({ week: 3, status: "future", sub: "Same days, a little heavier", right: "Starts Nov 30" });
  });
  it("shows weeks up to the next one", () => {
    expect(visibleWeekCount(2, 8)).toBe(3);
    expect(visibleWeekCount(8, 8)).toBe(8);
  });
});

describe("people count", () => {
  it("needs 10 or more", () => {
    expect(showPlanCount(9)).toBe(false);
    expect(showPlanCount(10)).toBe(true);
    expect(planSocialLine(null, 9)).toBeNull();
    expect(planSocialLine(null, 2340)).toEqual({ bold: null, rest: "2,340 people are doing this plan." });
    expect(planSocialLine({ firstName: "Maya", crewName: "FitFam", currentWeek: 5 }, 3)).toEqual({ bold: "Maya from FitFam", rest: " is on week 5." });
    expect(planSocialLine({ firstName: "Maya", crewName: "FitFam", currentWeek: 5 }, 2340)?.rest).toBe(" is on week 5. 2,340 people are doing this plan.");
  });
});

describe("today card", () => {
  const days = [0, 2, 4];
  it("paused wins", () => {
    expect(todayCard({ today: "2026-11-25", trainingDays: days, doneDates: [], paused: true })).toEqual({ kind: "paused" });
  });
  it("training day not done is a workout", () => {
    expect(todayCard({ today: "2026-11-25", trainingDays: days, doneDates: [] }).kind).toBe("workout");
  });
  it("rest day names the next training day", () => {
    expect(todayCard({ today: "2026-11-26", trainingDays: days, doneDates: [] })).toEqual({ kind: "rest", doneToday: false, nextWeekday: "Friday" });
  });
});

it("repeat note", () => {
  expect(repeatNote(8, [4, 8])).toBe("Weeks 2 to 8 repeat these days, a little harder each week. Weeks 4 and 8 are lighter so you recover.");
});
