import { describe, expect, it } from "vitest";
import { shouldShowWhatsNew, WHATS_NEW_VERSION, whatsNewLocalKey } from "@/lib/whats-new";

const CUT = "2026-11-23T09:40:00Z";
const base = { seenOnProfile: null, seenLocally: null };

describe("shouldShowWhatsNew", () => {
  it("shows to an account created before the release", () => {
    expect(shouldShowWhatsNew({ ...base, accountCreatedAt: "2026-06-01T00:00:00Z" }, "2026-11", CUT)).toBe(true);
  });
  it("never shows to an account created after the release", () => {
    expect(shouldShowWhatsNew({ ...base, accountCreatedAt: "2026-11-23T10:00:00Z" }, "2026-11", CUT)).toBe(false);
  });
  it("hides once the profile says this version was seen", () => {
    expect(shouldShowWhatsNew({ ...base, accountCreatedAt: "2026-06-01T00:00:00Z", seenOnProfile: "2026-11" }, "2026-11", CUT)).toBe(false);
  });
  it("hides when only the local fallback says it was seen", () => {
    expect(shouldShowWhatsNew({ ...base, accountCreatedAt: "2026-06-01T00:00:00Z", seenLocally: "2026-11" }, "2026-11", CUT)).toBe(false);
  });
  it("shows again for a newer version than the one seen", () => {
    expect(shouldShowWhatsNew({ ...base, accountCreatedAt: "2026-06-01T00:00:00Z", seenOnProfile: "2026-08" }, "2026-11", CUT)).toBe(true);
  });
  it("uses the 2026-11 version", () => {
    expect(WHATS_NEW_VERSION).toBe("2026-11");
  });
});

describe("whatsNewLocalKey", () => {
  it("keeps one account's dismissal from hiding the sheet for another account on the same device", () => {
    expect(whatsNewLocalKey("user-a")).not.toBe(whatsNewLocalKey("user-b"));
    expect(whatsNewLocalKey("user-a")).not.toBe("whats-new-seen");
  });
});
