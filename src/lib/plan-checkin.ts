/**
 * The plan day a check-in belongs to, carried from Workout done through
 * the camera to the post screen. Session-only; expires so a later, unrelated
 * check-in never picks it up.
 */
export type PlanCheckIn = {
  userPlanId: string;
  slug: string;
  planName: string;
  week: number;
  day: number;
  activity: "run" | "workout";
};

const KEY = "pactara:plan-checkin";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** `armed`: set by Workout done so the next check-in launch keeps it. */
export function setPlanCheckIn(value: PlanCheckIn, armed = true) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...value, at: Date.now(), armed }));
  } catch {
    /* private mode */
  }
}

export function getPlanCheckIn(): PlanCheckIn | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as PlanCheckIn & { at?: number; armed?: boolean };
    if (!v.userPlanId || !v.week || !v.day || !v.at || Date.now() - v.at > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    const { at: _at, armed: _armed, launchedAt: _launched, ...rest } = v as typeof v & { launchedAt?: number };
    return rest;
  } catch {
    return null;
  }
}

export function clearPlanCheckIn() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/**
 * Called when a check-in starts: keeps the plan day only when Workout done
 * just armed it, otherwise drops any plan day left over from earlier. A repeat
 * call within a few seconds (React re-running the launch effect) keeps it too.
 */
export function claimPlanCheckInForLaunch(now = Date.now()) {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const v = JSON.parse(raw) as { armed?: boolean; launchedAt?: number };
    if (v.armed) sessionStorage.setItem(KEY, JSON.stringify({ ...v, armed: false, launchedAt: now }));
    else if (!v.launchedAt || now - v.launchedAt > 5000) sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
