// Pure rules for the new-version "Notifications are off" banner.
export type PushPermission = "granted" | "denied" | "prompt" | "unsupported";

export const NOTIF_BANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const NOTIF_BANNER_KEY = "pactara:notif-banner-hidden-until";

/** Native only: denied, or never asked while in at least one active crew; hidden while snoozed. */
export function shouldShowNotifBanner(o: { native: boolean; permission: PushPermission | null; activeCrews: number; hiddenUntil: number | null; now: number }): boolean {
  if (!o.native || !o.permission) return false;
  if (o.hiddenUntil != null && o.now < o.hiddenUntil) return false;
  if (o.permission === "denied") return true;
  return o.permission === "prompt" && o.activeCrews > 0;
}

export function notifBannerBody(crewNames: string[]): string {
  return crewNames.length === 1
    ? `${crewNames[0]} can't nudge you, and you'll miss check-ins.`
    : "Your crews can't nudge you, and you'll miss check-ins.";
}

/** Preview-only ?notif=denied|default switch for screenshots. */
export function parseNotifParam(search: string): PushPermission | null {
  const v = new URLSearchParams(search).get("notif");
  return v === "denied" ? "denied" : v === "default" ? "prompt" : null;
}
