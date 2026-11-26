import { BADGE_MILESTONES, BADGE_META } from './badges';
import { addDaysIso, currentStreak } from './streak-rules';

/** Pure rules for the new-version Your progress page. */

export type ProgressCrew = { dates: string[]; covered: string[] };

/** Same streak as the profile header: the best current run across crews. */
export function progressStreak(crews: ProgressCrew[], today: string): number {
  return Math.max(0, ...crews.map(c => currentStreak(new Set([...c.dates, ...c.covered]), today)));
}

/** All-time check-ins, counting a check-in copied into several crews once. */
export function uniqueCheckIns(rows: { checkin_date: string; photo_url: string | null; created_at: string }[]): number {
  return new Set(rows.map(r => r.photo_url ?? `${r.checkin_date}|${r.created_at.slice(0, 16)}`)).size;
}

/** One PR per exercise per logged workout, within the given month (YYYY-MM). */
export function prsInMonth(rows: { session_id: string | null; exercise_id: string; local_date: string; is_pr: boolean }[], month: string): number {
  return new Set(rows.filter(r => r.is_pr && r.local_date.startsWith(month)).map(r => `${r.session_id}|${r.exercise_id}`)).size;
}

export type DayCell = { date: string; state: 'workout' | 'rest' | 'none' | 'future' } | null;

/** Mon–Sun grid for a month; null cells pad the first week. */
export function monthGrid(month: string, today: string, workouts: Set<string>, rest: Set<string>): DayCell[] {
  const first = `${month}-01`;
  const dow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: DayCell[] = Array.from({ length: dow }, () => null);
  for (let d = first; d.startsWith(month); d = addDaysIso(d, 1)) {
    const state = d > today ? 'future' : workouts.has(d) ? 'workout' : rest.has(d) ? 'rest' : 'none';
    cells.push({ date: d, state });
  }
  return cells;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const t = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string, today: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  return month.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${y}`;
}

export type BadgeTile =
  | { kind: 'earned'; days: number; name: string; earnedAt: string }
  | { kind: 'next'; days: number; name: string; streak: number }
  | { kind: 'locked'; days: number; name: string };

/** Next badge = the first unearned milestone above the current streak. */
export function nextBadge(streak: number, earned: Set<number>): number | null {
  return BADGE_MILESTONES.find(m => m > streak && !earned.has(m)) ?? null;
}

export function badgeTiles(streak: number, earned: { days: number; earnedAt: string }[]): BadgeTile[] {
  const byDays = new Map<number, string>();
  for (const b of earned) { const prev = byDays.get(b.days); if (!prev || b.earnedAt < prev) byDays.set(b.days, b.earnedAt); }
  const next = nextBadge(streak, new Set(byDays.keys()));
  return BADGE_MILESTONES.map(days => {
    const name = BADGE_META[days]?.title ?? `${days} days`;
    const at = byDays.get(days);
    if (at) return { kind: 'earned', days, name, earnedAt: at };
    if (days === next) return { kind: 'next', days, name, streak };
    return { kind: 'locked', days, name };
  });
}

/** Early badges are purple in the badge art, a week and up amber. */
export const medalColor = (days: number) => (days < 7 ? '#A78BFA' : '#F59E0B');

export const nextBadgeLine = (target: number, streak: number) => {
  const left = target - streak;
  return `${left} more ${left === 1 ? 'day' : 'days'}. You're on ${streak}.`;
};

export const freezeHint = (n: number) => (n > 0 ? `Missed a day? Use one of your ${n} ${n === 1 ? 'freeze' : 'freezes'} to keep your streak.` : null);
