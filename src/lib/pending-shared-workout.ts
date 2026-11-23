import { isShareCode } from "@/lib/workout-share";

/**
 * A shared-workout link opened while signed out. Kept in localStorage so it
 * survives signup, onboarding, the paywall and an app relaunch; Home saves
 * it once the member is in.
 */
const KEY = "pending-shared-workout";

export function setPendingSharedWorkout(code: string) {
  try {
    if (isShareCode(code)) localStorage.setItem(KEY, code);
  } catch {
    /* storage unavailable */
  }
}

export function getPendingSharedWorkout(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return isShareCode(v) ? v : null;
  } catch {
    return null;
  }
}

export function clearPendingSharedWorkout() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
