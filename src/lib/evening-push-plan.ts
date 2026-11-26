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
 * 8 PM "Last call", the 9 PM "streak at risk", or their own daily check-in
 * reminder when it's set between 8:00 and 9:59 PM — never two. The 5 PM
 * reminder and daily reminders at other times aren't part of this.
 *
 * - 8 PM: one push names every group still waiting, at-risk groups first
 *   with the streak wording. A member whose groups are ALL at risk is left
 *   for the 9 PM push instead.
 * - 9 PM: one push names every group at risk, unless an evening push already
 *   went out tonight (a failed one doesn't count).
 * - Daily reminder at 20:xx / 21:xx: claims the same slot.
 * - Every send is claimed first in `evening_push_sends` (user, local date),
 *   so a job running twice or overlapping still sends one push.
 */

export const LAST_CALL_HOUR = 20;
export const STREAK_RISK_HOUR = 21;
export type EveningPushHour = typeof LAST_CALL_HOUR | typeof STREAK_RISK_HOUR;

export type PushPayload = { title: string; body: string; url: string; crewIds?: string[] };
export type EveningPushSource = "last_call" | "streak_risk" | "daily_reminder";
export type EveningPushPlan = {
  hour: EveningPushHour;
  source: EveningPushSource;
  groupIds: string[];
  message: PushPayload;
};

/** A personal daily reminder in this local hour counts as the night's evening push (8:00–9:59 PM). */
export function isEveningPushHour(hour: number): hour is EveningPushHour {
  return hour === LAST_CALL_HOUR || hour === STREAK_RISK_HOUR;
}

/** The personal daily reminder as an evening push, when it falls between 8:00 and 9:59 PM. */
export function dailyReminderEveningPlan(
  hour: number,
  groupIds: string[],
  message: PushPayload,
): EveningPushPlan | null {
  if (!isEveningPushHour(hour)) return null;
  return { hour, source: "daily_reminder", groupIds, message };
}

export function planEveningPush(input: {
  hour: EveningPushHour;
  timezone: string;
  groups: RiskGroupInput[];
  hasFreeze: boolean;
  now?: Date;
}): EveningPushPlan | null {
  const now = input.now ?? new Date();
  if (input.hour === STREAK_RISK_HOUR) {
    const risky = atRiskGroups(input.timezone, input.groups, now);
    if (risky.length === 0) return null;
    return {
      hour: STREAK_RISK_HOUR,
      source: "streak_risk",
      groupIds: risky.map((g) => g.groupId),
      message: streakRiskMessage(risky, input.hasFreeze),
    };
  }
  // 8 PM: every group still waiting, at-risk first; empty when all are at risk (left for 9 PM).
  const groups = eveningReminderGroups(LAST_CALL_HOUR, input.timezone, input.groups, now);
  if (groups.length === 0) return null;
  return {
    hour: LAST_CALL_HOUR,
    source: "last_call",
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
  finish: (
    userId: string,
    localDate: string,
    status: "sent" | "failed",
    groupIds: string[],
    source: EveningPushSource,
  ) => Promise<void>;
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
  const result = await deps.push(userId, { ...plan.message, crewIds: plan.groupIds }).catch(() => ({ webSent: 0, fcmSent: 0 }));
  const delivered = result.webSent + result.fcmSent;
  await deps.finish(userId, localDate, delivered > 0 ? "sent" : "failed", plan.groupIds, plan.source);
  return { claimed: true, delivered };
}
