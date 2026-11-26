import { describe, expect, it } from 'vitest';
import { followProfileStats } from '../follow-profile';

describe('Follow profile aggregates', () => {
  it('uses the highest current crew streak, not cross-crew combined dates', () => {
    expect(followProfileStats({ timezone: 'UTC', badge_count: 3, crews: [
      { id: 'a', dates: ['2026-11-24', '2026-11-26'], freezes: [] },
      { id: 'b', dates: ['2026-11-25', '2026-11-26'], freezes: [] },
    ] }, new Date('2026-11-26T12:00:00Z'))).toEqual({ current_streak: 2, badge_count: 3 });
  });
  it('uses the member local date and includes applied freezes', () => {
    expect(followProfileStats({ timezone: 'America/Los_Angeles', badge_count: 1, crews: [
      { id: 'a', dates: ['2026-11-24'], freezes: ['2026-11-25'] },
    ] }, new Date('2026-11-26T02:00:00Z')).current_streak).toBe(2);
  });
  it('returns zero streak and badges for a member with no activity', () => {
    expect(followProfileStats({ timezone: 'UTC', badge_count: 0, crews: [] })).toEqual({ current_streak: 0, badge_count: 0 });
  });
});