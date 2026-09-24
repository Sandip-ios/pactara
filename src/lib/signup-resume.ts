const KEY = "signup-resume";

export type SignupResume = {
  step: string;
  firstName?: string;
  groupId?: string;
  method?: "people" | "partner";
  // Sitting on the partner intro screen (signup finished, search not started).
  onPartner?: boolean;
};

/**
 * Remembers where someone was in signup once their account already exists, so
 * closing the app on (say) the invite screen brings them back to it instead of
 * dropping them on Home.
 */
export function saveSignupResume(state: SignupResume) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage unavailable
  }
}

export function getSignupResume(): SignupResume | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SignupResume;
    return parsed && typeof parsed.step === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSignupResume() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
