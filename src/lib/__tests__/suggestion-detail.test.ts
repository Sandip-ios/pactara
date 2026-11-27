import { describe, expect, it } from "vitest";
import { suggestionDetail } from "@/lib/suggestion-detail";

describe("suggestionDetail", () => {
  it("joins bio first line and follower count", () => {
    expect(suggestionDetail("Back and glutes", 12400)).toBe("Back and glutes · 12.4k followers");
  });
  it("shows only followers when bio is empty", () => {
    expect(suggestionDetail(null, 3)).toBe("3 followers");
    expect(suggestionDetail("  ", 1)).toBe("1 follower");
  });
});
