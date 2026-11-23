/**
 * "What's new" sheet rules (pure). The sheet for WHATS_NEW_VERSION shows once,
 * on Home, to members whose account (profiles.created_at) existed before the
 * release cutoff. New signups never get it automatically; anyone can open it
 * from Account settings.
 */
export const WHATS_NEW_VERSION = "2026-11";
/** Accounts created at or after this moment are new to the app and skip the sheet. */
export const WHATS_NEW_CUTOFF = "2026-11-23T17:31:00Z";
/**
 * Local fallback when saving the seen version on the profile fails. Scoped to
 * the account: a device-wide flag let one account's dismissal hide the sheet
 * from every other account signed in on the same browser or phone.
 */
export function whatsNewLocalKey(userId: string): string {
  return `whats-new-seen:${userId}`;
}

export type WhatsNewState = {
  accountCreatedAt: string | null | undefined;
  /** profiles.whats_new_seen */
  seenOnProfile: string | null | undefined;
  /** localStorage fallback value */
  seenLocally: string | null | undefined;
};

export function shouldShowWhatsNew(
  s: WhatsNewState,
  version: string = WHATS_NEW_VERSION,
  cutoff: string = WHATS_NEW_CUTOFF,
): boolean {
  if (s.seenOnProfile === version || s.seenLocally === version) return false;
  if (!s.accountCreatedAt) return false;
  const created = new Date(s.accountCreatedAt).getTime();
  const cut = new Date(cutoff).getTime();
  if (Number.isNaN(created) || Number.isNaN(cut)) return false;
  return created < cut;
}

export type WhatsNewItem = { emoji: string; tint: string; title: string; line: string };

export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    emoji: "🏋️",
    tint: "#EDE7FB",
    title: "Workouts",
    line: "A new Workouts tab. Build your own workouts, log every set and watch your lifts go up.",
  },
  {
    emoji: "🗺️",
    tint: "#DCFCE7",
    title: "18 plans to follow",
    line: "A plan for every goal, from 15-minute mobility to gym splits. Not sure which? Answer 4 quick questions.",
  },
  {
    emoji: "🎬",
    tint: "#FFEDD5",
    title: "Share your win on social",
    line: "Post your check-in video to Instagram, Facebook and more, with your streak on it.",
  },
  {
    emoji: "🔗",
    tint: "#E0F2FE",
    title: "Share workouts and plans",
    line: "Send one to your crew chat or share a link. Friends can save it in one tap.",
  },
];
