import {
  currentStreak,
  dayAtRisk,
  localWeek,
  restAllowance,
  type GroupSchedule,
} from "@/lib/streak-rules";

/**
 * Pure planners for the evening pushes. Each group is judged on its own, in
 * the member's timezone: a group still needs a check-in today only when no
 * check-in, rest or freeze row covers today and no rest day is left this
 * Mon–Sun week. 5 PM / 8 PM remind about those groups; 9 PM "streak at risk"
 * also needs a live streak to lose.
 */

/** Only warn when there's a real streak to lose. */
export const MIN_AT_RISK_STREAK = 2;

export type RiskGroupInput = {
  groupId: string;
  name: string;
  schedule: GroupSchedule;
  checkIns: Set<string>;
  /** kind = 'rest' rows (count toward this week's rest days). */
  rests: Set<string>;
  /** Streak-freeze rows (protect a day, don't use a rest day). */
  freezes: Set<string>;
};

export type AtRiskGroup = { groupId: string; name: string; streak: number };

/**
 * Groups where today still needs a check-in: nothing covers today yet (no
 * check-in, rest or freeze row) and no rest day is left this Mon–Sun week, so
 * no automatic rest day will cover it.
 */
export function groupsNeedingCheckIn(
  timezone: string,
  groups: RiskGroupInput[],
  now: Date = new Date(),
): RiskGroupInput[] {
  const { today, weekStart, weekEnd } = localWeek(timezone, now);
  return groups.filter((g) => {
    let restUsed = 0;
    for (const d of g.rests) if (d >= weekStart && d <= weekEnd) restUsed += 1;
    return dayAtRisk({
      checkedInToday: g.checkIns.has(today),
      protectedToday: g.rests.has(today) || g.freezes.has(today),
      restUsedThisWeek: restUsed,
      allowance: restAllowance(g.schedule),
    });
  });
}

export function atRiskGroups(timezone: string, groups: RiskGroupInput[], now: Date = new Date()): AtRiskGroup[] {
  const { today } = localWeek(timezone, now);
  const out: AtRiskGroup[] = [];
  for (const g of groupsNeedingCheckIn(timezone, groups, now)) {
    const kept = new Set<string>([...g.checkIns, ...g.rests, ...g.freezes]);
    const streak = currentStreak(kept, today);
    if (streak >= MIN_AT_RISK_STREAK) out.push({ groupId: g.groupId, name: g.name, streak });
  }
  return out;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function checkInUrl(groups: { groupId: string }[]): string {
  return groups.length === 1 ? `/check-in?group=${groups[0]!.groupId}` : "/check-in";
}

/** One 9 PM push per member, naming every group at risk. Freezes only protect yesterday. */
export function streakRiskMessage(groups: AtRiskGroup[], hasFreeze: boolean) {
  const one = groups.length === 1;
  const it = one ? "it" : "them";
  const tail = hasFreeze
    ? `Check in before midnight, or use a streak freeze tomorrow to protect ${it}.`
    : `Check in before midnight to keep ${it} alive.`;
  if (one) {
    const g = groups[0]!;
    return {
      title: `Your ${g.streak}-day streak in ${g.name} is at risk 🔥`,
      body: `No rest days left this week. ${tail}`,
      url: checkInUrl(groups),
    };
  }
  return {
    title: `${groups.length} streaks are at risk 🔥`,
    body: `No rest days left this week in ${joinNames(groups.map((g) => g.name))}. ${tail}`,
    url: checkInUrl(groups),
  };
}

export const EVENING_REMINDER_HOURS = [17, 20] as const;

/** One 5 PM / 8 PM push per member, naming every group that still needs a check-in. */
export function eveningReminderMessage(hour: number, groups: { groupId: string; name: string }[]) {
  const names = joinNames(groups.map((g) => g.name));
  const url = checkInUrl(groups);
  if (hour === 17) {
    return {
      title: "Still time to check in ⏳",
      body: `Log today's check-in for ${names} before the day gets away.`,
      url,
    };
  }
  return {
    title: "Last call to check in 🌙",
    body: `Don't break your ${groups.length === 1 ? "streak" : "streaks"} in ${names} — check in before bed.`,
    url,
  };
}
