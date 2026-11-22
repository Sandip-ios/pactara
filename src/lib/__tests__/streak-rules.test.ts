import { describe, expect, it } from "vitest";
import {
  closeDay,
  currentStreak,
  groupStreak,
  localWeek,
  restAllowance,
  weekStartIso,
  weeklyTarget,
} from "../streak-rules";

describe("weeks run Monday to Sunday in the member's timezone", () => {
  // Monday Nov 16 2026, 03:00 UTC = Sunday Nov 15 evening in the US.
  const mondayEarlyUtc = new Date("2026-11-16T03:00:00Z");

  it("America/Chicago is still in the week of Nov 9 (Sunday night)", () => {
    expect(localWeek("America/Chicago", mondayEarlyUtc)).toEqual({
      today: "2026-11-15",
      weekStart: "2026-11-09",
      weekEnd: "2026-11-15",
    });
  });

  it("America/New_York is still Sunday Nov 15 too", () => {
    expect(localWeek("America/New_York", mondayEarlyUtc).weekStart).toBe("2026-11-09");
  });

  it("UTC has already started the week of Nov 16", () => {
    expect(localWeek("UTC", mondayEarlyUtc)).toEqual({
      today: "2026-11-16",
      weekStart: "2026-11-16",
      weekEnd: "2026-11-22",
    });
  });

  it("New York rolls into the new week at its own midnight", () => {
    expect(localWeek("America/New_York", new Date("2026-11-16T05:00:00Z")).weekStart).toBe("2026-11-16");
    expect(localWeek("America/Chicago", new Date("2026-11-16T05:00:00Z")).weekStart).toBe("2026-11-09");
  });

  it("Sunday belongs to the week that started the Monday before", () => {
    expect(weekStartIso("2026-11-22")).toBe("2026-11-16");
    expect(weekStartIso("2026-11-23")).toBe("2026-11-23");
  });
});

describe("rest days allowed per week", () => {
  it("is 7 minus the days per week", () => {
    expect(restAllowance({ frequency: "specific", days_per_week: 5 })).toBe(2);
    expect(restAllowance({ frequency: "specific", days_per_week: 3 })).toBe(4);
    expect(restAllowance({ frequency: "specific", days_per_week: 6 })).toBe(1);
  });

  it("stays at 2 for 7-days-a-week and daily groups", () => {
    expect(restAllowance({ frequency: "specific", days_per_week: 7 })).toBe(2);
    expect(restAllowance({ frequency: "daily", days_per_week: 7 })).toBe(2);
    expect(restAllowance({ frequency: "daily", days_per_week: 3 })).toBe(2);
  });

  it("weekly target follows days per week", () => {
    expect(weeklyTarget({ frequency: "specific", days_per_week: 5 })).toBe(5);
    expect(weeklyTarget({ frequency: "daily", days_per_week: 7 })).toBe(7);
  });
});

describe("a day that closes without a check-in", () => {
  const fiveDayGroup = restAllowance({ frequency: "specific", days_per_week: 5 });

  it("uses a rest day automatically while any are left, then is missed", () => {
    let used = 0;
    const outcomes = [] as string[];
    for (let day = 0; day < 3; day++) {
      const o = closeDay({ checkedIn: false, protectedDay: false, restUsedThisWeek: used, allowance: fiveDayGroup });
      if (o === "rest") used += 1;
      outcomes.push(o);
    }
    expect(outcomes).toEqual(["rest", "rest", "missed"]);
  });

  it("is kept when they checked in or a freeze covers it", () => {
    expect(closeDay({ checkedIn: true, protectedDay: false, restUsedThisWeek: 9, allowance: 2 })).toBe("kept");
    expect(closeDay({ checkedIn: false, protectedDay: true, restUsedThisWeek: 9, allowance: 2 })).toBe("kept");
  });
});

describe("current streak uses the member's local date", () => {
  it("does not drop to 0 on a US evening when UTC is already tomorrow", () => {
    // Fri Nov 20, 8 PM in Chicago = Sat Nov 21 02:00 UTC. Checked in Tue–Thu, not yet today.
    const kept = new Set(["2026-11-17", "2026-11-18", "2026-11-19"]);
    const evening = new Date("2026-11-21T02:00:00Z");
    expect(currentStreak(kept, localWeek("America/Chicago", evening).today)).toBe(3);
    // The old UTC-date logic looked at Nov 21 / Nov 20 and found nothing.
    expect(currentStreak(kept, evening.toISOString().slice(0, 10))).toBe(0);
  });

  it("counts rest days and freezes as kept", () => {
    const kept = new Set(["2026-11-18", "2026-11-19", "2026-11-20"]); // check-in, rest, freeze
    expect(currentStreak(kept, "2026-11-20")).toBe(3);
  });
});

describe("group streak with mixed rest days", () => {
  it("counts days where every joined member checked in or rested", () => {
    const ana = { joinedOn: "2026-11-01", kept: new Set(["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]) };
    // Ben rested on the 18th (still kept), checked in on the others.
    const ben = { joinedOn: "2026-11-01", kept: new Set(["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]) };
    expect(groupStreak([ana, ben], "2026-11-20")).toBe(4);
  });

  it("breaks on a day one member neither checked in nor rested", () => {
    const ana = { joinedOn: "2026-11-01", kept: new Set(["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]) };
    const ben = { joinedOn: "2026-11-01", kept: new Set(["2026-11-17", "2026-11-19", "2026-11-20"]) };
    expect(groupStreak([ana, ben], "2026-11-20")).toBe(2);
  });

  it("ignores members on days before they joined", () => {
    const ana = { joinedOn: "2026-11-01", kept: new Set(["2026-11-18", "2026-11-19", "2026-11-20"]) };
    const newcomer = { joinedOn: "2026-11-20", kept: new Set(["2026-11-20"]) };
    expect(groupStreak([ana, newcomer], "2026-11-20")).toBe(3);
  });
});
