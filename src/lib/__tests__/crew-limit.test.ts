import { describe, expect, it } from "vitest";
import { atCrewLimit, crewLimitLine, unreadBadgeLabel } from "../crew-limit";

describe("crew limit", () => {
  it("3 crews is the limit, 2 is not", () => {
    expect(atCrewLimit(3)).toBe(true);
    expect(atCrewLimit(2)).toBe(false);
  });
  it("limit line names 3 of 3", () => {
    expect(crewLimitLine()).toBe("You're in 3 of 3 crews. Leave one to join or start another.");
  });
  it("unread badge reads N new and hides at 0", () => {
    expect(unreadBadgeLabel(3)).toBe("3 new");
    expect(unreadBadgeLabel(0)).toBeNull();
  });
});
