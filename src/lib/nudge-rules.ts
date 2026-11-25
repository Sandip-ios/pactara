/**
 * Pure rules for nudging a groupmate:
 * - at most once per person, per group, per local day (the nudger's timezone);
 * - never when the person's day is already covered for that group
 *   (check-in, rest or freeze row), judged on their own local date.
 */
export type NudgeResult =
  | { ok: true; message: string }
  | { ok: false; reason: "already_nudged" | "covered" | "not_allowed"; message: string };

export function nudgeDecision(input: {
  firstName: string;
  alreadyNudgedToday: boolean;
  targetCoveredToday: boolean;
  blocked?: boolean;
}): NudgeResult | null {
  const name = input.firstName || "They";
  if (input.blocked) return { ok: false, reason: 'not_allowed', message: 'Nudge not allowed' };
  if (input.alreadyNudgedToday) {
    return { ok: false, reason: "already_nudged", message: `You already nudged ${name} today` };
  }
  if (input.targetCoveredToday) {
    return { ok: false, reason: "covered", message: `${name}'s covered today` };
  }
  return null; // allowed
}

export function alreadyNudgedResult(firstName: string): NudgeResult {
  return nudgeDecision({ firstName, alreadyNudgedToday: true, targetCoveredToday: false })!;
}
