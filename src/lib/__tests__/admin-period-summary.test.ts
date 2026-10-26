import { describe, expect, it } from "vitest";
import { buildPeriodSummary } from "../admin/period-summary";

const input = {
  to: "2026-10-26",
  activity: new Map([['marcia', new Set(['2026-10-21', '2026-10-24'])], ['jose', new Set(['2026-10-26'])]]),
  signups: ['2026-10-21', '2026-09-20', '2026-08-01', '2026-06-22'],
  posts: [
    { user_id: 'jose', group_id: 'a', local_date: '2026-10-26', check_in_id: 'proof-a' },
    { user_id: 'jose', group_id: 'b', local_date: '2026-10-26', check_in_id: 'proof-b' },
    { user_id: 'marcia', group_id: 'a', local_date: '2026-10-24', check_in_id: null },
  ],
  opens: new Map([['2026-10-24', 3], ['2026-10-26', 2]]),
};

describe('admin selected-period summary', () => {
  it('includes Marcia’s October 21 signup in the last 7 days, not today', () => {
    expect(buildPeriodSummary({ ...input, from: '2026-10-20' }).newAccounts).toBe(1);
    expect(buildPeriodSummary({ ...input, from: '2026-10-26' }).newAccounts).toBe(0);
  });
  it.each([['2026-09-27', 1], ['2026-07-29', 3], ['2016-10-26', 4]])('counts accounts in the chosen window from %s', (from, count) => {
    expect(buildPeriodSummary({ ...input, from }).newAccounts).toBe(count);
  });
  it('updates every summary metric with the selected period', () => {
    expect(buildPeriodSummary({ ...input, from: '2026-10-20' })).toEqual({
      activeUsers: 2, newAccounts: 1, commitments: 2, completed: 1, completionRate: 0.5, activeGroups: 2, opens: 5,
    });
    expect(buildPeriodSummary({ ...input, from: '2026-10-26' })).toEqual({
      activeUsers: 1, newAccounts: 0, commitments: 1, completed: 1, completionRate: 1, activeGroups: 2, opens: 2,
    });
  });
  it('excludes cross-group copies from commitment and completion counts', () => {
    const summary = buildPeriodSummary({ ...input, from: '2026-10-26' });
    expect(summary.commitments).toBe(1);
    expect(summary.completed).toBe(1);
  });
});