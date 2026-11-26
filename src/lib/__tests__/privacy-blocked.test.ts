import { describe, expect, it } from 'vitest';
import { blockedOnLabel, isUnder18, switchPublicBody } from '../redesign-profile';

describe('account privacy rules', () => {
  it('locks private until the 18th birthday', () => {
    const today = new Date(2026, 10, 26);
    expect(isUnder18('2010-06-01', today)).toBe(true);
    expect(isUnder18('2008-11-27', today)).toBe(true);
    expect(isUnder18('2008-11-26', today)).toBe(false);
    expect(isUnder18(null, today)).toBe(false);
  });
  it('mentions pending requests only when there are some', () => {
    expect(switchPublicBody(2)).toBe('Anyone can see your profile and follow you. People with pending requests (2) will follow you automatically.');
    expect(switchPublicBody(0)).toBe('Anyone can see your profile and follow you.');
  });
  it('labels the block date as Mon D', () => {
    expect(blockedOnLabel('2026-11-03T12:00:00Z')).toBe('Blocked Nov 3');
  });
});
