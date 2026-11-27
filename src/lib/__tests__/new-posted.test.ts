import { describe, expect, it } from "vitest";
import { highestPostedBadge, postedCrew, postedCrewChip, postedMediaHeight, postedStreak } from "../new-posted";

describe("new Posted screen", () => {
  it("shows the first selected crew where the check-in counted", () => {
    const groups = [{ id: "later" }, { id: "counted" }, { id: "last" }];
    expect(postedCrew(groups, { later: false, counted: true, last: true })?.id).toBe("counted");
    expect(postedCrew(groups, { later: false, counted: false, last: false })?.id).toBe("later");
    expect(postedCrew([], {})).toBeNull();
  });

  it("labels additional selected crews", () => {
    expect(postedCrewChip(1)).toBeNull();
    expect(postedCrewChip(2)).toBe("+1 crew");
    expect(postedCrewChip(3)).toBe("+2 crews");
  });

  it("uses Day N only when at least one selected crew counted the check-in", () => {
    expect(postedStreak(20, true)).toEqual({ counted: true, day: 20 });
    expect(postedStreak(20, false)).toEqual({ counted: false, text: "Already in today · 20-day streak" });
  });

  it("picks the highest newly unlocked badge", () => {
    expect(highestPostedBadge([3, 14, 7])).toBe(14);
    expect(highestPostedBadge([])).toBeNull();
  });

  it("makes room for the badge banner in the media height", () => {
    expect(postedMediaHeight(true)).toBe(380);
    expect(postedMediaHeight(false)).toBe(430);
  });
});
