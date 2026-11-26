import { describe, expect, it } from "vitest";
import { daysShownUp, isPactDone, longestCrewRun, newPactBannerBody, newPactPush, nextPactStartLabel, pactDoneSubtitle, pactLastDay } from "../pact-cycle";

describe("pact cycle", () => {
  it("a 30-day pact from Nov 1 ends Nov 30 and is done on Dec 1", () => {
    expect(pactLastDay("2026-11-01", 30)).toBe("2026-11-30");
    expect(isPactDone("2026-11-30", "2026-11-01", 30)).toBe(false);
    expect(isPactDone("2026-12-01", "2026-11-01", 30)).toBe(true);
  });
  it("counts unique check-in days inside the pact only", () => {
    expect(daysShownUp(["2026-10-31", "2026-11-01", "2026-11-01", "2026-11-30", "2026-12-01"], "2026-11-01", 30)).toBe(2);
  });
  it("longest crew run needs everyone in", () => {
    const a = { joinedOn: "2026-11-01", days: new Set(["2026-11-01", "2026-11-02", "2026-11-03"]) };
    const b = { joinedOn: "2026-11-01", days: new Set(["2026-11-02", "2026-11-03"]) };
    expect(longestCrewRun([a, b], "2026-11-01", 30)).toBe(2);
  });
  it("subtitle drops the streak sentence at 0", () => {
    expect(pactDoneSubtitle(0, 5)).toBe("5 check-ins together.");
    expect(pactDoneSubtitle(4, 12)).toBe("Longest crew streak this pact: 4 days. 12 check-ins together.");
  });
  it("copy for push, banner and start date", () => {
    expect(newPactPush("FitFam", 60)).toBe("FitFam started a new 60-day pact.");
    expect(newPactBannerBody(null)).toBe("Everyone is in for this one. Set a new goal for it.");
    expect(newPactBannerBody({ shown: 18, total: 30 })).toBe("Last pact you showed up 18 of 30 days. Everyone is in for this one. Set a new goal for it.");
    expect(nextPactStartLabel("2026-12-05")).toBe("Dec 5");
  });
});
