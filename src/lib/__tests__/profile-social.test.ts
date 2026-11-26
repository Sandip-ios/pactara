import { describe, expect, it } from 'vitest';
import { SOCIAL_PAGE_SIZE, activityReadBatches, activitySection, filterSocialPeople, socialFollowAction } from '../profile-social';

describe('profile social rules', () => {
  it('pages by exactly 30 people', () => { expect(SOCIAL_PAGE_SIZE).toBe(30); });
  it('marks all 501 notifications through the existing 500-key write limit', () => {
    const keys = Array.from({ length: 501 }, (_, index) => `event:${index}`);
    const batches = activityReadBatches(keys);
    expect(batches.map(batch => batch.length)).toEqual([500, 1]);
    expect(batches.flat()).toEqual(keys);
  });
  it('searches name case-insensitively', () => {
    const people = [{ name: 'Maya Lee', username: 'runner' }, { name: 'Blake Rivera', username: 'blake' }];
    expect(filterSocialPeople(people, ' MAYA ')).toEqual([people[0]]);
  });
  it('searches username case-insensitively', () => {
    const people = [{ name: 'Maya Lee', username: 'runner' }, { name: 'Blake Rivera', username: 'blake' }];
    expect(filterSocialPeople(people, 'RUNNER')).toEqual([people[0]]);
  });
  it('never offers a follow action on yourself', () => { expect(socialFollowAction({ isSelf: true, canFollow: true, relationship: 'none' })).toBeNull(); });
  it('never offers a new follow on an ineligible target', () => { expect(socialFollowAction({ isSelf: false, canFollow: false, relationship: 'none' })).toBeNull(); });
  it('preserves an existing following action even if the target switched to classic', () => { expect(socialFollowAction({ isSelf: false, canFollow: false, relationship: 'following' })).toBe('Following'); });
  it('does not offer Follow again while a request is pending', () => { expect(socialFollowAction({ isSelf: false, canFollow: true, relationship: 'requested' })).toBe('Requested'); });
  it('puts a notification on the current local day in Today', () => { expect(activitySection(new Date(2026, 10, 26, 1).toISOString(), new Date(2026, 10, 26, 7))).toBe('TODAY'); });
  it('puts Monday into This week', () => { expect(activitySection(new Date(2026, 10, 23, 23).toISOString(), new Date(2026, 10, 26, 7))).toBe('THIS WEEK'); });
  it('puts the previous Sunday into Earlier', () => { expect(activitySection(new Date(2026, 10, 22, 23).toISOString(), new Date(2026, 10, 26, 7))).toBe('EARLIER'); });
});