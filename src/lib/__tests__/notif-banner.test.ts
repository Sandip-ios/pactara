import { describe, expect, it } from "vitest";
import { NOTIF_BANNER_SNOOZE_MS, notifBannerBody, parseNotifParam, shouldShowNotifBanner } from "../notif-banner";

const base = { native: true, permission: "denied" as const, activeCrews: 1, hiddenUntil: null, now: 1_000 };
describe("notifications-off banner", () => {
  it("never shows on web", () => expect(shouldShowNotifBanner({ ...base, native: false })).toBe(false));
  it("shows when denied", () => expect(shouldShowNotifBanner(base)).toBe(true));
  it("never shows once notifications are on", () => expect(shouldShowNotifBanner({ ...base, permission: "granted" })).toBe(false));
  it("never-asked needs at least one active crew", () => {
    expect(shouldShowNotifBanner({ ...base, permission: "prompt", activeCrews: 0 })).toBe(false);
    expect(shouldShowNotifBanner({ ...base, permission: "prompt", activeCrews: 1 })).toBe(true);
  });
  it("X hides it for 7 days, then it comes back", () => {
    const hiddenUntil = 1_000 + NOTIF_BANNER_SNOOZE_MS;
    expect(shouldShowNotifBanner({ ...base, hiddenUntil, now: hiddenUntil - 1 })).toBe(false);
    expect(shouldShowNotifBanner({ ...base, hiddenUntil, now: hiddenUntil })).toBe(true);
    expect(NOTIF_BANNER_SNOOZE_MS).toBe(7 * 86_400_000);
  });
  it("names the crew only when there is one", () => {
    expect(notifBannerBody(["QA Crew"])).toBe("QA Crew can't nudge you, and you'll miss check-ins.");
    expect(notifBannerBody(["A", "B"])).toBe("Your crews can't nudge you, and you'll miss check-ins.");
  });
  it("preview switch", () => {
    expect(parseNotifParam("?notif=denied")).toBe("denied");
    expect(parseNotifParam("?notif=default")).toBe("prompt");
    expect(parseNotifParam("?v=new")).toBeNull();
  });
});
