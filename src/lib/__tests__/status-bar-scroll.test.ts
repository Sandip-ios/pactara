import { describe, expect, it } from "vitest";
import { isScrollLocked, LOCK_GRACE_MS, shouldTreatAsStatusTap } from "../status-bar-scroll";

const open = { bodyOverflow: "visible", htmlOverflow: "visible", bodyPosition: "static", scrollLockAttr: false, overlayOpen: false };

describe("status-bar parking stands down for sheets and menus", () => {
  it("sees a lock from overflow hidden, position fixed, the scroll-lock attribute or an open overlay", () => {
    expect(isScrollLocked(open)).toBe(false);
    expect(isScrollLocked({ ...open, bodyOverflow: "hidden" })).toBe(true);
    expect(isScrollLocked({ ...open, htmlOverflow: "hidden" })).toBe(true);
    expect(isScrollLocked({ ...open, bodyPosition: "fixed" })).toBe(true);
    expect(isScrollLocked({ ...open, scrollLockAttr: true })).toBe(true);
    expect(isScrollLocked({ ...open, overlayOpen: true })).toBe(true);
  });

  it("does not scroll the feed to the top when a sheet's lock moves the page", () => {
    expect(shouldTreatAsStatusTap({ scrollY: 0, park: 2, locked: true, msSinceLastLock: 0 })).toBe(false);
    expect(shouldTreatAsStatusTap({ scrollY: 0, park: 2, locked: false, msSinceLastLock: LOCK_GRACE_MS - 1 })).toBe(false);
  });

  it("still treats a jump to the top as a clock tap when nothing is open", () => {
    expect(shouldTreatAsStatusTap({ scrollY: 0, park: 2, locked: false, msSinceLastLock: Infinity })).toBe(true);
    expect(shouldTreatAsStatusTap({ scrollY: 2, park: 2, locked: false, msSinceLastLock: Infinity })).toBe(false);
  });
});
