import { describe, expect, it } from "vitest";
import { feedDayNumber } from "@/lib/feed-view";

// The workout done preview asks for today's Day N as if today's check-in exists;
// the feed prints the same number on the post once it does.
describe("workout done preview Day N", () => {
  it("continues the member's run: Day 4 after three kept days", () => {
    expect(feedDayNumber(["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"], [], "2026-11-22")).toBe(4);
  });
  it("rest days keep the run going", () => {
    expect(feedDayNumber(["2026-11-20", "2026-11-22"], ["2026-11-21"], "2026-11-22")).toBe(3);
  });
  it("after missed days it really is Day 1", () => {
    expect(feedDayNumber(["2026-11-18", "2026-11-22"], ["2026-11-19"], "2026-11-22")).toBe(1);
  });
});
