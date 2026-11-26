import { describe, expect, it } from "vitest";
import { checkedInSubline, crewShowedUpLine, redesignWeekCell, reminderClock } from "@/lib/redesign-crew-view";

describe("new crew Today copy", () => {
  it("includes the viewer only while they are still due", () => {
    expect(crewShowedUpLine(1, 3, false)).toBe("2 still to go, including you. Everyone needs to be in to keep the crew streak.");
    expect(crewShowedUpLine(1, 3, true)).toBe("2 still to go. Everyone needs to be in to keep the crew streak.");
    expect(crewShowedUpLine(3, 3, true)).toBe("Everyone's in. Crew streak safe.");
  });

  it("formats an existing reminder without inventing a time", () => {
    expect(reminderClock("21:05")).toBe("9:05 pm");
    expect(reminderClock("09:00")).toBe("9:00 am");
    expect(reminderClock("")).toBeNull();
  });

  it("keeps rest, freeze, today and future cells distinct", () => {
    expect(redesignWeekCell({ date: "2026-11-25", state: "rest", today: "2026-11-26", coverKind: "rest" })).toBe("rest");
    expect(redesignWeekCell({ date: "2026-11-25", state: "rest", today: "2026-11-26", coverKind: "freeze" })).toBe("freeze");
    expect(redesignWeekCell({ date: "2026-11-26", state: "none", today: "2026-11-26" })).toBe("today");
    expect(redesignWeekCell({ date: "2026-11-27", state: "none", today: "2026-11-26" })).toBe("empty");
  });

  it("uses an attached workout name without changing the streak", () => {
    expect(checkedInSubline("Upper body", 4)).toBe("Upper body · 4-day streak");
    expect(checkedInSubline(null, 1)).toBe("1-day streak");
  });
});
