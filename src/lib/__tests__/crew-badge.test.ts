import { describe, expect, it } from "vitest";
import { unreadBadgeLabel } from "../crew-badge";

describe("crew card chat badge", () => {
  it("reads N new", () => expect(unreadBadgeLabel(3)).toBe("3 new"));
  it("is hidden at 0", () => expect(unreadBadgeLabel(0)).toBeNull());
});
