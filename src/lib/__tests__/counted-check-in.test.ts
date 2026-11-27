import { describe, expect, it } from 'vitest';
import { countedCheckInId, distinctDays } from '../counted-check-in';
import { currentStreak, weekCounts } from '../streak-rules';
import { feedDayNumber } from '../feed-view';
import { profileStats } from '../profile-tabs';

const a = { id: 'a', created_at: '2026-11-27T08:00:00Z' };
const b = { id: 'b', created_at: '2026-11-27T12:00:00Z' };

describe('first check-in of the day counts', () => {
  it('picks the earliest check-in', () => expect(countedCheckInId([b, a])).toBe('a'));
  it('breaks ties by id', () => expect(countedCheckInId([{ id: 'z', created_at: a.created_at }, a])).toBe('a'));
  it('later one takes over after the first is deleted', () => expect(countedCheckInId([b])).toBe('b'));
  it('no check-ins left means nothing counts', () => expect(countedCheckInId([])).toBeNull());
  it('totals count days, not posts', () => expect(distinctDays(['2026-11-26', '2026-11-27', '2026-11-27'])).toBe(2));
  it('a second same-day row leaves the streak alone', () => {
    expect(currentStreak(new Set(['2026-11-26', '2026-11-27']), '2026-11-27')).toBe(2);
    expect(currentStreak(new Set(['2026-11-26', '2026-11-27', '2026-11-27']), '2026-11-27')).toBe(2);
  });
  it('a second same-day row leaves Day N and the week count alone', () => {
    const rows = ['2026-11-25', '2026-11-27', '2026-11-27'];
    expect(feedDayNumber(rows, [], '2026-11-27')).toBe(feedDayNumber(['2026-11-25', '2026-11-27'], [], '2026-11-27'));
    expect(weekCounts(rows, '2026-11-27').thisWeek).toBe(2);
  });
  it('profile stats total counts days', () => {
    const s = profileStats({ joinedOn: '2026-11-01', today: '2026-11-27', checkIns: ['2026-11-27', '2026-11-27'], covered: [], target: 3 });
    expect(s.totalCheckIns).toBe(1);
  });
});
