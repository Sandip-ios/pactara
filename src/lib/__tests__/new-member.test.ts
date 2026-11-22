import { describe, expect, it } from "vitest";
import { isNewMember } from "../new-member";

const now = new Date("2026-11-22T17:00:00Z");

describe("How Pactara works pill: new member = account created in the last 21 days", () => {
  it("shows for an account created 20 days ago", () => {
    expect(isNewMember("2026-11-02T17:00:00Z", now)).toBe(true);
  });

  it("hides for an account created 22 days ago, even if they just started a new group", () => {
    expect(isNewMember("2026-10-31T17:00:00Z", now)).toBe(false);
  });

  it("hides when the account date is unknown", () => {
    expect(isNewMember(null, now)).toBe(false);
  });
});
