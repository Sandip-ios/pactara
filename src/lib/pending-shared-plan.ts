import { isPlanSlug } from "@/lib/plan-share";

/**
 * A shared-plan link opened while signed out. Kept in localStorage so it
 * survives signup, onboarding, the paywall and an app relaunch; Home opens
 * the plan page once the member is in (it never starts the plan).
 */
const KEY = "pending-shared-plan";

export function setPendingSharedPlan(slug: string) {
  try {
    if (isPlanSlug(slug)) localStorage.setItem(KEY, slug);
  } catch {
    /* storage unavailable */
  }
}

export function takePendingSharedPlan(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return isPlanSlug(v) ? v : null;
  } catch {
    return null;
  }
}
