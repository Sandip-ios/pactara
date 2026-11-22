import {
  atRiskGroups,
  eveningReminderGroups,
  eveningReminderMessage,
  streakRiskMessage,
  type RiskGroupInput,
} from "@/lib/streak-risk-plan";
import { localDateIn } from "@/lib/streak-rules";

/**
 * One evening push per member per local day, across all their groups: the
 * 8 PM "Last call" or the 9 PM "streak at risk", never both. The 5 PM
 * reminder isn't part of this.
 *
 * - 8 PM: if any group will get the 9 PM streak-at-risk push, the member is
 *   left for 9 PM (that warning matters more). Otherwise one push names every
 *   group still needing a check-in.
 * - 9 PM: one push names every group at risk, unless an 8 PM push already
 *   went out tonight (a failed 8 PM push doesn't count).
 * - Every send is claimed first in `evening_push_sends` (user, local date),
 *   so a job running twice or overlapping still sends one push.
 */

export const LAST_CALL_HOUR = 20;
export const STREAK_RISK_HOUR = 21;
export type EveningPushHour = typeof LAST_CALL_HOUR | typeof STREAK_RISK_HOUR;

export type PushPayload = { title: string; body: string; url: string };
export type EveningPushPlan = { hour: EveningPushHour; groupIds: string[]; message: PushPayload };

export function planEveningPush(input: {
  hour: EveningPushHour;
  timezone: string;
  groups: RiskGroupInput[];
  hasFreeze: boolean;
  now?: Date;
}): EveningPushPlan | null {
  const now = input.now ?? new Date();
  const risky = atRiskGroups(input.timezone, input.groups, now);
  if (input.hour === STREAK_RISK_HOUR) {
    if (risky.length === 0) return null;
    return {
      hour: STREAK_RISK_HOUR,
      groupIds: risky.map((g) => g.groupId),
      message: streakRiskMessage(risky, input.hasFreeze),
    };
  }
  // 8 PM: the 9 PM warning will cover this member tonight.
  if (risky.length > 0) return null;
  const groups = eveningReminderGroups(LAST_CALL_HOUR, input.timezone, input.groups, now);
  if (groups.length === 0) return null;
  return {
    hour: LAST_CALL_HOUR,
    groupIds: groups.map((g) => g.groupId),
    message: eveningReminderMessage(LAST_CALL_HOUR, groups),
  };
}

export type EveningPushRecord = { hour: number; status: "sending" | "sent" | "failed" };

/**
 * Same rule as the `claim_evening_push` database function: send only when
 * nothing went out tonight yet, or a later hour takes over an earlier push
 * that failed to deliver.
 */
export function canClaimEveningPush(existing: EveningPushRecord | null | undefined, hour: number): boolean {
  if (!existing) return true;
  return existing.status === "failed" && hour > existing.hour;
}

export type EveningPushDeps = {
  /** Atomically claims (user, local date) for this hour; false = someone already sent tonight. */
  claim: (userId: string, localDate: string, hour: EveningPushHour) => Promise<boolean>;
  /** Records the outcome of a claimed send. */
  finish: (userId: string, localDate: string, status: "sent" | "failed", groupIds: string[]) => Promise<void>;
  push: (userId: string, message: PushPayload) => Promise<{ webSent: number; fcmSent: number }>;
};

/** Claims tonight's slot, sends once and records whether it was delivered. Returns devices reached. */
export async function sendEveningPush(
  deps: EveningPushDeps,
  userId: string,
  timezone: string,
  plan: EveningPushPlan,
  now: Date = new Date(),
): Promise<{ claimed: boolean; delivered: number }> {
  const localDate = localDateIn(timezone, now);
  if (!(await deps.claim(userId, localDate, plan.hour))) return { claimed: false, delivered: 0 };
  const result = await deps.push(userId, plan.message).catch(() => ({ webSent: 0, fcmSent: 0 }));
  const delivered = result.webSent + result.fcmSent;
  await deps.finish(userId, localDate, delivered > 0 ? "sent" : "failed", plan.groupIds);
  return { claimed: true, delivered };
}
