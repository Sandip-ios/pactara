import {
  currentStreak,
  dayAtRisk,
  dayCovered,
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

function streakIn(g: RiskGroupInput, today: string): number {
  return currentStreak(new Set<string>([...g.checkIns, ...g.rests, ...g.freezes]), today);
}

export function atRiskGroups(timezone: string, groups: RiskGroupInput[], now: Date = new Date()): AtRiskGroup[] {
  const { today } = localWeek(timezone, now);
  return groupsNeedingCheckIn(timezone, groups, now)
    .map((g) => ({ groupId: g.groupId, name: g.name, streak: streakIn(g, today) }))
    .filter((g) => g.streak >= MIN_AT_RISK_STREAK);
}

export type ReminderGroup = { groupId: string; name: string; streak: number };

/**
 * Groups a 5 PM / 8 PM reminder should name. At 8 PM, groups that will get the
 * 9 PM "streak at risk" push are left out (so a member whose groups are all
 * at risk gets no 8 PM push at all).
 */
export function eveningReminderGroups(
  hour: number,
  timezone: string,
  groups: RiskGroupInput[],
  now: Date = new Date(),
): ReminderGroup[] {
  const { today } = localWeek(timezone, now);
  const need = groupsNeedingCheckIn(timezone, groups, now).map((g) => ({
    groupId: g.groupId,
    name: g.name,
    streak: streakIn(g, today),
  }));
  if (hour !== 20) return need;
  return need.filter((g) => g.streak < MIN_AT_RISK_STREAK);
}

/**
 * Groups the morning reminder should name: today isn't covered yet (no
 * check-in, rest or freeze row). Rest days left don't matter here — the
 * morning push is a friendly nudge, not a warning.
 */
export function morningReminderGroups(
  timezone: string,
  groups: RiskGroupInput[],
  now: Date = new Date(),
): RiskGroupInput[] {
  const { today } = localWeek(timezone, now);
  return groups.filter((g) => !dayCovered(today, g.checkIns, new Set([...g.rests, ...g.freezes])));
}

/** Morning push naming every group still waiting on today's check-in. */
export function morningReminderMessage(
  groups: { groupId: string; name: string; day?: number | null; total?: number | null }[],
) {
  const title = "Time to check in ✅";
  const url = checkInUrl(groups);
  if (groups.length === 1) {
    const g = groups[0]!;
    const body =
      g.day && g.total
        ? g.day === g.total
          ? `Final day of ${g.name} — finish strong and check in. 🏁`
          : `Day ${g.day} of ${g.total} in ${g.name} — keep it going. 🔥`
        : `Log today's check-in for ${g.name}. 🔥`;
    return { title, body, url };
  }
  return { title, body: `Check in for ${joinNames(groups.map((g) => g.name))} today — keep it going. 🔥`, url };
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
export function eveningReminderMessage(hour: number, groups: { groupId: string; name: string; streak?: number }[]) {
  const names = joinNames(groups.map((g) => g.name));
  const url = checkInUrl(groups);
  if (hour === 17) {
    return {
      title: "Still time to check in ⏳",
      body: `Log today's check-in for ${names} before the day gets away.`,
      url,
    };
  }
  const hasStreak = groups.some((g) => (g.streak ?? 0) >= MIN_AT_RISK_STREAK);
  return {
    title: "Last call to check in 🌙",
    body: hasStreak
      ? `Don't break your ${groups.length === 1 ? "streak" : "streaks"} in ${names} — check in before bed.`
      : `Check in for ${names} before bed.`,
    url,
  };
}
