import { describe, expect, it } from "vitest";
import { eligibleCrewIds, nextCheckInBadge } from "../redesign-checkin";
import type { GroupToday } from "../group-today.functions";

describe("new check-in presentation", () => {
  it("excludes already checked-in crews from the default multi-crew selection", () => {
    const groups = [{ id: "a", members: [{ isYou: true, status: "done" }] }, { id: "b", members: [{ isYou: true, status: "not_committed" }] }] as GroupToday[];
    expect(eligibleCrewIds(groups)).toEqual(["b"]);
  });
  it("uses the existing next badge thresholds", () => {
    expect(nextCheckInBadge(1)).toEqual({ milestone: 3, remaining: 2 });
    expect(nextCheckInBadge(90)).toBeNull();
  });
});