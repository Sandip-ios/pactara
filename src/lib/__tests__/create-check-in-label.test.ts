import { describe, expect, it } from "vitest";
import { createCheckInLabel } from "../create-check-in-label";

describe("Create check-in destination", () => {
  it("names exactly one active crew", () => {
    expect(createCheckInLabel(1, "FitFam")).toBe("Check in to FitFam");
  });
  it("does not name a crew for two or more active crews", () => {
    expect(createCheckInLabel(2, "FitFam")).toBe("Check in");
    expect(createCheckInLabel(5, "FitFam")).toBe("Check in");
  });
  it("does not imply a destination before the count loads or with no crews", () => {
    expect(createCheckInLabel(undefined, "your crew")).toBe("Check in");
    expect(createCheckInLabel(0, "your crew")).toBe("Check in");
  });
});