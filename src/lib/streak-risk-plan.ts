import {
  addDaysIso,
  currentStreak,
  dayAtRisk,
  localWeek,
  restAllowance,
  type GroupSchedule,
} from "@/lib/streak-rules";

/**
 * Pure planner for the 9 PM "streak at risk" push. Each group is judged on
 * its own: a group is at risk only when the member hasn't checked in today
 * for it, no rest/freeze row covers today, no rest days are left this
 * Mon–Sun week (member's timezone), and there is a live streak to lose.
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

export function atRiskGroups(timezone: string, groups: RiskGroupInput[], now: Date = new Date()): AtRiskGroup[] {
  const { today, weekStart } = localWeek(timezone, now);
  const out: AtRiskGroup[] = [];
  for (const g of groups) {
    let restUsed = 0;
    for (const d of g.rests) if (d >= weekStart && d <= addDaysIso(weekStart, 6)) restUsed += 1;
    const risky = dayAtRisk({
      checkedInToday: g.checkIns.has(today),
      protectedToday: g.rests.has(today) || g.freezes.has(today),
      restUsedThisWeek: restUsed,
      allowance: restAllowance(g.schedule),
    });
    if (!risky) continue;
    const kept = new Set<string>([...g.checkIns, ...g.rests, ...g.freezes]);
    const streak = currentStreak(kept, today);
    if (streak >= MIN_AT_RISK_STREAK) out.push({ groupId: g.groupId, name: g.name, streak });
  }
  return out;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** One push per member, naming every group at risk. */
export function streakRiskMessage(groups: AtRiskGroup[], hasFreeze: boolean) {
  const tail = hasFreeze
    ? "Check in before midnight — or use a streak freeze to protect it."
    : "Check in before midnight to keep it alive.";
  if (groups.length === 1) {
    const g = groups[0]!;
    return {
      title: `Your ${g.streak}-day streak in ${g.name} is at risk 🔥`,
      body: `No rest days left this week. ${tail}`,
      url: `/check-in?group=${g.groupId}`,
    };
  }
  return {
    title: `${groups.length} streaks are at risk 🔥`,
    body: `No rest days left this week in ${joinNames(groups.map((g) => g.name))}. ${tail.replace("protect it", "protect them").replace("keep it alive", "keep them alive")}`,
    url: "/check-in",
  };
}
