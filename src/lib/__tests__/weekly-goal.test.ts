import { describe, expect, it } from "vitest";
import { weekDayStates, weeksOnGoal } from "../streak-rules";

// Weeks: Oct 26–Nov 1, Nov 2–8, Nov 9–15, Nov 16–22 (all Mon–Sun, 2026).
const fiveEach = (monday: string, days: number[]) =>
  days.map((d) => {
    const dt = new Date(`${monday}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + d);
    return dt.toISOString().slice(0, 10);
  });

describe("weeks on goal", () => {
  it("counts completed Mon–Sun weeks where check-ins reached the target", () => {
    const dates = [
      ...fiveEach("2026-10-26", [0, 1, 2, 3, 4]), // 5 → hit
      ...fiveEach("2026-11-02", [0, 1, 2, 3, 4]), // 5 → hit
      ...fiveEach("2026-11-09", [0, 2, 4]), // 3 → not hit
      ...fiveEach("2026-11-16", [0, 1, 2, 3, 4, 5]), // current week, not counted
    ];
    // Joined Monday Oct 26; today is Sunday Nov 22 (still the current week).
    expect(weeksOnGoal(dates, "2026-10-26", "2026-11-22", 5)).toEqual({ hit: 2, completed: 3 });
  });

  it("counts the week once Monday arrives", () => {
    const dates = fiveEach("2026-11-16", [0, 1, 2, 3, 4]);
    expect(weeksOnGoal(dates, "2026-11-16", "2026-11-23", 5)).toEqual({ hit: 1, completed: 1 });
  });

  it("skips the partial week someone joined mid-week", () => {
    // Joined Wednesday Nov 4 → first counted week is Nov 9–15.
    const dates = [...fiveEach("2026-11-02", [2, 3, 4, 5, 6]), ...fiveEach("2026-11-09", [0, 1, 2, 3])];
    expect(weeksOnGoal(dates, "2026-11-04", "2026-11-18", 5)).toEqual({ hit: 0, completed: 1 });
  });

  it("uses the group's own target (3 days a week)", () => {
    const dates = fiveEach("2026-11-09", [0, 2, 4]);
    expect(weeksOnGoal(dates, "2026-11-09", "2026-11-18", 3)).toEqual({ hit: 1, completed: 1 });
  });

  it("counts a day once even with two check-ins", () => {
    const dates = ["2026-11-09", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"];
    expect(weeksOnGoal(dates, "2026-11-09", "2026-11-18", 5)).toEqual({ hit: 0, completed: 1 });
  });

  it("is 0/0 before any week has finished", () => {
    expect(weeksOnGoal([], "2026-11-18", "2026-11-22", 5)).toEqual({ hit: 0, completed: 0 });
  });
});

describe("Home week dots", () => {
  it("runs Monday to Sunday with check-in, rest and empty days", () => {
    const states = weekDayStates(
      "2026-11-16",
      new Set(["2026-11-16", "2026-11-18"]),
      new Set(["2026-11-17", "2026-11-18"]),
    ).map((d) => d.state);
    expect(states).toEqual(["checked", "rest", "checked", "none", "none", "none", "none"]);
  });
});
