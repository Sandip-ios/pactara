import { describe, expect, it } from 'vitest';
import { BADGE_MILESTONES } from '../badges';
import { bestStreakRange, freezeHint, profileBadges, profileStats, weeklyGoalInsight } from '../profile-tabs';
import { addDaysIso } from '../streak-rules';
const earned = [1, 3, 7, 14].map(streakDays => ({ streakDays, earnedAt: '2026-09-01T20:00:00Z' }));
describe('profile badges', () => {
  it('selects the next unearned milestone and own progress', () => {
    const v = profileBadges(earned, 18, true, 'José');
    expect(v.next).toMatchObject({ milestone: 30, title: 'One month', progress: 18, text: "12 more days. You're on 18.", ariaLabel: 'Progress to One month' });
  });
  it('uses neutral other-member wording and named progress', () => {
    expect(profileBadges(earned, 18, false, 'Maya').next).toMatchObject({ label: "Maya's next badge", text: "12 more days. They're on 18.", ariaLabel: "Maya's progress to One month" });
  });
  it('hides next badge when all nine are earned', () => expect(profileBadges(BADGE_MILESTONES.map(streakDays => ({ streakDays, earnedAt: '2026-09-01' })), 100, true, 'José').next).toBeNull());
  it('keeps earned, next and locked cells in milestone order', () => {
    const v = profileBadges(earned, 18, true, 'José');
    expect(v.earned).toBe(4);
    expect(v.cells.map(c => c.milestone)).toEqual([1,3,7,14,30,45,60,75,90]);
    expect(v.cells[0]).toMatchObject({ state: 'earned', title: 'First day', caption: 'Sep 1' });
    expect(v.cells[4]).toMatchObject({ state: 'next', caption: '18 of 30' });
    expect(v.cells[5]).toMatchObject({ state: 'locked', caption: '45-day streak' });
  });
  it('keeps earned badges after a streak reset and clamps progress', () => {
    expect(profileBadges(earned, 0, true, 'José').next?.progress).toBe(0);
    expect(profileBadges([], 100, true, 'José').next?.progress).toBe(1);
  });
  it('uses the singular freeze wording', () => expect(freezeHint(1)).toBe('Missed a day? Use your 1 freeze to keep your streak.'));
  it('uses the plural freeze wording', () => expect(freezeHint(2)).toBe('Missed a day? Use one of your 2 freezes to keep your streak.'));
});
const input = { joinedOn: '2026-11-24', today: '2026-11-27', checkIns: ['2026-11-24'], covered: ['2026-11-25'], target: 4 };
describe('showing up', () => {
  const v = profileStats(input);
  it('uses Monday-first cells with before-join/future empty', () => expect(v.columns[0]?.days.map(d => d.state)).toEqual(['empty','checked','rest','missed','today','empty','empty']));
  it('counts only joined days through today and actual check-ins', () => expect([v.checked, v.days]).toEqual([1,4]));
  it('caps to 13 weeks including current with a matching denominator', () => {
    const v = profileStats({ ...input, joinedOn: '2026-01-01' });
    expect(v.columns).toHaveLength(13);
    expect(v.columns[0]?.monday).toBe('2026-08-31');
    expect(v.days).toBe(89);
    expect(v.title).toBe('Last 13 weeks');
  });
  it('keeps checks ahead of protected days and today uncompleted', () => expect(profileStats({ ...input, covered: ['2026-11-24'] }).columns[0]?.days[1]?.state).toBe('checked'));
  it('does not count before-join checks in totals', () => expect(profileStats({ ...input, checkIns: ['2026-11-23','2026-11-24'] }).totalCheckIns).toBe(1));
  it('multiple workouts count as check-ins but one calendar cell', () => {
    const v = profileStats({ ...input, checkIns: ['2026-11-24','2026-11-24'] });
    expect(v.totalCheckIns).toBe(2); expect(v.checked).toBe(1); expect(v.thisWeek).toBe(1);
  });
});
describe('weekly bars', () => {
  it('shows eight completed weeks plus the current week', () => {
    const v = profileStats({ ...input, joinedOn: '2026-01-01', checkIns: ['2026-11-16','2026-11-23','2026-11-24','2026-11-25'] });
    expect(v.bars).toHaveLength(9);
    expect(v.bars[0]?.monday).toBe('2026-09-28');
    expect(v.bars[8]).toMatchObject({ current: true, label: 'Now', count: 3, height: 3/7*100 });
    expect(v.lastWeek).toBe(1);
  });
  it('has only Now before any full week is completed', () => expect(profileStats(input).bars.map(b => b.label)).toEqual(['Now']));
  it('omits the partial joining week from completed bars and goals', () => {
    const v = profileStats({ ...input, joinedOn: '2026-11-11' });
    expect(v.bars.map(b => b.monday)).toEqual(['2026-11-16','2026-11-23']);
    expect(v.goal.completed).toBe(1);
  });
});
describe('weekly goal insight', () => {
  it('no completed weeks', () => expect(weeklyGoalInsight(0,0,[])).toBe('No full week yet'));
  it('all weeks hit', () => expect(weeklyGoalInsight(12,12,[])).toBe('Hit every week'));
  it('one missed week', () => expect(weeklyGoalInsight(11,12,['2026-09-21'])).toBe('Hit every week but Sep 21'));
  it('several missed weeks', () => expect(weeklyGoalInsight(10,12,['2026-09-21','2026-09-28'])).toBe('Hit 10 of 12 weeks'));
});
describe('best streak dates', () => {
  it('finds the actual longest range without duplicate-day inflation', () => {
    const dates = Array.from({ length: 24 }, (_, i) => addDaysIso('2026-10-15',i));
    expect(bestStreakRange(['2026-09-01',...dates,'2026-10-15','2026-11-10'])).toEqual({ count: 24, start: '2026-10-15', end: '2026-11-07', text: 'Oct 15 to Nov 7' });
  });
  it('includes protected days in streak but not check-in counts', () => expect(profileStats(input).best).toMatchObject({ count: 2, text: 'Nov 24 to Nov 25' }));
  it('does not invent dates with no kept days', () => expect(bestStreakRange([])).toEqual({ count: 0, start: null, end: null, text: 'No streak yet' }));
});
