import { BADGE_META, BADGE_MILESTONES } from './badges';
import { addDaysIso, weekStartIso, weeksOnGoal } from './streak-rules';

export function shortDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export function profileBadges(earned: { streakDays: number; earnedAt: string }[], streak: number, own: boolean, firstName: string) {
  const dates = new Map(earned.map(b => [b.streakDays, b.earnedAt]));
  const next = BADGE_MILESTONES.find(n => !dates.has(n));
  return {
    earned: BADGE_MILESTONES.filter(n => dates.has(n)).length,
    next: next === undefined ? null : {
      milestone: next, ...BADGE_META[next], progress: Math.min(next, Math.max(0, streak)),
      label: own ? 'Next badge' : `${firstName}'s next badge`,
      text: `${Math.max(0, next - streak)} more days. ${own ? "You're" : "They're"} on ${streak}.`,
      ariaLabel: `${own ? 'Progress' : `${firstName}'s progress`} to ${BADGE_META[next].title}`,
    },
    cells: BADGE_MILESTONES.map(n => ({ milestone: n, ...BADGE_META[n],
      state: dates.has(n) ? 'earned' as const : n === next ? 'next' as const : 'locked' as const,
      caption: dates.has(n) ? shortDate(dates.get(n) ?? '') : n === next ? `${streak} of ${n}` : `${n}-day streak`,
    })),
  };
}
export function freezeHint(n: number) {
  return n === 1 ? 'Missed a day? Use your 1 freeze to keep your streak.' : `Missed a day? Use one of your ${n} freezes to keep your streak.`;
}
export type ProfileStatsInput = { joinedOn: string; today: string; checkIns: string[]; covered: string[]; target: number };
export function bestStreakRange(kept: Iterable<string>) {
  let start: string | null = null, end: string | null = null, bestStart: string | null = null, bestEnd: string | null = null;
  let run = 0, best = 0;
  for (const date of [...new Set(kept)].sort()) {
    if (end && addDaysIso(end, 1) === date) run++;
    else { start = date; run = 1; }
    end = date;
    if (run > best) { best = run; bestStart = start; bestEnd = date; }
  }
  return { count: best, start: bestStart, end: bestEnd, text: bestStart && bestEnd ? `${shortDate(bestStart)} to ${shortDate(bestEnd)}` : 'No streak yet' };
}
export function weeklyGoalInsight(hit: number, completed: number, missedMondays: string[]) {
  if (completed === 0) return 'No full week yet';
  if (missedMondays.length === 0) return 'Hit every week';
  if (missedMondays.length === 1) return `Hit every week but ${shortDate(missedMondays[0])}`;
  return `Hit ${hit} of ${completed} weeks`;
}
export function profileStats(input: ProfileStatsInput) {
  const { joinedOn, today, target } = input;
  const checks = [...new Set(input.checkIns)].filter(d => d >= joinedOn && d <= today);
  const checked = new Set(checks);
  const covered = new Set(input.covered.filter(d => d >= joinedOn && d <= today));
  const currentMonday = weekStartIso(today);
  const joinMonday = weekStartIso(joinedOn);
  const capMonday = addDaysIso(currentMonday, -12 * 7);
  const firstMonday = joinMonday > capMonday ? joinMonday : capMonday;
  const columns = [];
  let dayCount = 0, checkedCount = 0;
  for (let monday = firstMonday; monday <= currentMonday; monday = addDaysIso(monday, 7)) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDaysIso(monday, i);
      const state = date < joinedOn || date > today ? 'empty' : checked.has(date) ? 'checked' : covered.has(date) ? 'rest' : date === today ? 'today' : 'missed';
      if (state !== 'empty') dayCount++;
      if (state === 'checked') checkedCount++;
      return { date, state };
    });
    columns.push({ monday, days });
  }
  const months: { index: number; label: string }[] = [];
  for (const [index, column] of columns.entries()) {
    const visible = column.days.find(d => d.state !== 'empty');
    if (!visible) continue;
    const label = shortDate(visible.date).split(' ')[0];
    if (months.at(-1)?.label !== label) months.push({ index, label });
  }
  const countWeek = (monday: string) => Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i)).filter(d => checked.has(d)).length;
  const firstCompleted = joinMonday < joinedOn ? addDaysIso(joinMonday, 7) : joinMonday;
  const missedMondays: string[] = [];
  for (let monday = firstCompleted; monday < currentMonday; monday = addDaysIso(monday, 7)) if (countWeek(monday) < target) missedMondays.push(monday);
  const goal = weeksOnGoal(checks, joinedOn, today, target);
  const bars = [];
  const oldestBar = addDaysIso(currentMonday, -8 * 7);
  const barStart = firstCompleted > oldestBar ? firstCompleted : oldestBar;
  for (let monday = barStart; monday <= currentMonday; monday = addDaysIso(monday, 7)) {
    const current = monday === currentMonday;
    const count = countWeek(monday);
    bars.push({ monday, count, current, height: count / 7 * 100, label: current ? 'Now' : bars.length % 2 === 0 ? shortDate(monday) : '' });
  }
  if (!bars.length) bars.push({ monday: currentMonday, count: countWeek(currentMonday), current: true, height: countWeek(currentMonday) / 7 * 100, label: 'Now' });
  return { columns, months, title: joinMonday < capMonday ? 'Last 13 weeks' : 'Showing up', checked: checkedCount, days: dayCount,
    totalCheckIns: checks.length, bars, goal, goalText: weeklyGoalInsight(goal.hit, goal.completed, missedMondays),
    thisWeek: countWeek(currentMonday), lastWeek: countWeek(addDaysIso(currentMonday, -7)), best: bestStreakRange([...checked, ...covered]), target };
}
export type ProfileStats = ReturnType<typeof profileStats>;
