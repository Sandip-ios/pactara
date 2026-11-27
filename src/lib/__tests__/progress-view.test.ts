import { describe, expect, it } from 'vitest';
import { badgeTiles, freezeHint, medalColor, monthGrid, nextBadge, nextBadgeLine, prsInMonth, progressStreak, shiftMonth, uniqueCheckIns } from '../progress-view';

describe('progress view', () => {
  it('streak is the best run across crews, rest/freeze days keep it', () => {
    expect(progressStreak([{ dates: ['2026-11-24', '2026-11-26'], covered: ['2026-11-25'] }, { dates: ['2026-11-26'], covered: [] }], '2026-11-26')).toBe(3);
  });
  it('counts a check-in copied into two crews once', () => {
    expect(uniqueCheckIns([
      { checkin_date: '2026-11-26', photo_url: 'a.jpg', created_at: '2026-11-26T08:00:00Z' },
      { checkin_date: '2026-11-26', photo_url: 'a.jpg', created_at: '2026-11-26T08:00:01Z' },
      { checkin_date: '2026-11-25', photo_url: null, created_at: '2026-11-25T08:00:00Z' },
    ])).toBe(2);
  });
  it('PRs this month: one per exercise per workout', () => {
    expect(prsInMonth([
      { session_id: 's', exercise_id: 'e', local_date: '2026-11-03', is_pr: true },
      { session_id: 's', exercise_id: 'e', local_date: '2026-11-03', is_pr: true },
      { session_id: 's', exercise_id: 'f', local_date: '2026-11-03', is_pr: false },
      { session_id: 't', exercise_id: 'e', local_date: '2026-10-30', is_pr: true },
    ], '2026-11')).toBe(1);
  });
  it('month grid starts Monday and marks states', () => {
    const g = monthGrid('2026-11', '2026-11-03', new Set(['2026-11-02']), new Set(['2026-11-01']));
    expect(g.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(g[6]).toEqual({ date: '2026-11-01', state: 'rest' });
    expect(g[7]?.state).toBe('workout');
    expect(g[8]?.state).toBe('none');
    expect(g[9]?.state).toBe('future');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('uses purple for a first-day medal and amber for two weeks', () => {
    expect(medalColor(1)).toBe('#A78BFA');
    expect(medalColor(14)).toBe('#F59E0B');
  });
  it('next badge is the first unearned milestone above the streak', () => {
    expect(nextBadge(5, new Set([1, 3]))).toBe(7);
    expect(nextBadge(95, new Set())).toBeNull();
    const tiles = badgeTiles(5, [{ days: 1, earnedAt: '2026-11-02' }, { days: 3, earnedAt: '2026-11-04' }]);
    expect(tiles.map(t => t.kind).slice(0, 4)).toEqual(['earned', 'earned', 'next', 'locked']);
    expect(nextBadgeLine(7, 5)).toBe("2 more days. You're on 5.");
    expect(freezeHint(0)).toBeNull();
    expect(freezeHint(2)).toBe('Missed a day? Use one of your 2 freezes to keep your streak.');
  });
});
