import { describe, expect, it } from "vitest";
import { reactionNotifiesAuthor } from "../reaction-recipient";

describe("reaction notifications and Activity", () => {
  it("excludes the author's own cheer from push and Activity recipients", () => {
    expect(reactionNotifiesAuthor("owner", "owner")).toBe(false);
  });
  it("retains another member's cheer", () => {
    expect(reactionNotifiesAuthor("primrose", "owner")).toBe(true);
  });
  it("does not notify for a missing post", () => {
    expect(reactionNotifiesAuthor("owner", undefined)).toBe(false);
  });
});