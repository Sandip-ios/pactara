import { isNative } from "./native";

/**
 * Native App Store review prompt (StoreKit `requestReview`).
 *
 * iOS decides whether the sheet actually appears (max 3 times per year), so we
 * only gate locally to avoid asking on every single check-in.
 */

const LAST_KEY = "app-review-last-prompt";
const MIN_DAYS_BETWEEN_PROMPTS = 90;

function canPromptNow(): boolean {
  try {
    const last = localStorage.getItem(LAST_KEY);
    if (!last) return true;
    const elapsed = Date.now() - Number(last);
    if (!Number.isFinite(elapsed)) return true;
    return elapsed > MIN_DAYS_BETWEEN_PROMPTS * 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

/** Ask iOS to show the App Store review modal. No-op on web. */
export async function requestAppStoreReview(): Promise<void> {
  if (!isNative()) return;
  if (!canPromptNow()) return;
  try {
    const { InAppReview } = await import("@capacitor-community/in-app-review");
    await InAppReview.requestReview();
    try {
      localStorage.setItem(LAST_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  } catch {
    // plugin unavailable (older native build) — ignore
  }
}
