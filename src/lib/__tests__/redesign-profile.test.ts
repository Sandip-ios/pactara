import { describe, expect, it } from 'vitest';
import { newProfileChanged, newProfileEditSchema, newProfileWeek, saveNewProfileFields, usernameSchema } from '../redesign-profile';

describe('New profile editing rules', () => {
  it('uses crew states for checked-in, rest, freeze, today and future days', () => {
    expect(newProfileWeek({ today: '2026-11-26', days: [{ date: '2026-11-23', state: 'checked' }, { date: '2026-11-24', state: 'rest' }, { date: '2026-11-25', state: 'rest' }, { date: '2026-11-26', state: 'none' }, { date: '2026-11-27', state: 'none' }], coverKinds: [{ date: '2026-11-24', kind: 'rest' }, { date: '2026-11-25', kind: 'freeze' }] })).toEqual([{ date: '2026-11-23', state: 'checked' }, { date: '2026-11-24', state: 'rest' }, { date: '2026-11-25', state: 'freeze' }, { date: '2026-11-26', state: 'today' }, { date: '2026-11-27', state: 'empty' }]);
  });
  it('requires a name of 1 to 50 characters', () => {
    const base = { username: 'test.member', bio: '' };
    expect(newProfileEditSchema.safeParse({ ...base, name: '' }).success).toBe(false);
    expect(newProfileEditSchema.safeParse({ ...base, name: 'A' }).success).toBe(true);
    expect(newProfileEditSchema.safeParse({ ...base, name: 'a'.repeat(50) }).success).toBe(true);
    expect(newProfileEditSchema.safeParse({ ...base, name: 'a'.repeat(51) }).success).toBe(false);
  });
  it('normalizes case and enforces 3 to 30 allowed username characters', () => {
    expect(usernameSchema.parse(' Maya_1. ')).toBe('maya_1.');
    for (const username of ['ab', 'a'.repeat(31), 'maya-name', 'maya name', 'mâyâ']) expect(usernameSchema.safeParse(username).success).toBe(false);
    for (const username of ['abc', 'a'.repeat(30), 'maya.1_']) expect(usernameSchema.safeParse(username).success).toBe(true);
  });
  it('limits bio to 150 characters', () => {
    const base = { name: 'Maya', username: 'maya' };
    expect(newProfileEditSchema.safeParse({ ...base, bio: 'a'.repeat(150) }).success).toBe(true);
    expect(newProfileEditSchema.safeParse({ ...base, bio: 'a'.repeat(151) }).success).toBe(false);
  });
  it('detects edits to all three fields and the photo, ignoring unchanged whitespace', () => {
    const original = { name: 'Maya', username: 'maya', bio: null };
    const draft = { name: 'Maya ', username: 'MAYA', bio: '' };
    expect(newProfileChanged(original, draft, false)).toBe(false);
    expect(newProfileChanged(original, { ...draft, name: 'Maya Lee' }, false)).toBe(true);
    expect(newProfileChanged(original, { ...draft, username: 'maya_1' }, false)).toBe(true);
    expect(newProfileChanged(original, { ...draft, bio: 'Training' }, false)).toBe(true);
    expect(newProfileChanged(original, draft, true)).toBe(true);
  });
  it('saves only the caller profile fields, never a crew goal', async () => {
    let table = ''; let fields: unknown; let filter: unknown;
    const db = { from: (t: 'profiles') => { table = t; return { update: (f: unknown) => { fields = f; return { eq: (key: string, id: string) => { filter = { key, id }; return { error: null }; } }; } }; } };
    await saveNewProfileFields(db, 'caller', { name: ' Maya ', username: 'MAYA_1', bio: '' });
    expect(table).toBe('profiles');
    expect(fields).toEqual({ name: 'Maya', username: 'maya_1', bio: null });
    expect(filter).toEqual({ key: 'id', id: 'caller' });
  });
  it('handles the unique constraint race with the taken-username message', async () => {
    const db = { from: () => ({ update: () => ({ eq: () => ({ error: { code: '23505' } }) }) }) };
    await expect(saveNewProfileFields(db, 'caller', { name: 'Maya', username: 'maya', bio: '' })).rejects.toThrow('That username is taken');
  });
});
import { progressSummary } from '../redesign-profile';
import { profileWeekChips } from '../redesign-profile';
describe('progressSummary', () => {
  it('hides zero parts', () => {
    expect(progressSummary(0, 0)).toBe('');
    expect(progressSummary(5, 0)).toBe('5-day streak');
    expect(progressSummary(0, 3)).toBe('3 badges');
    expect(progressSummary(12, 2)).toBe('12-day streak · 2 badges');
  });
});
describe('profileWeekChips', () => {
  it('never shows a zero-day streak', () => {
    expect(profileWeekChips(0, 2)).toEqual({ streak: false, freezes: true, any: true, single: true });
    expect(profileWeekChips(0, null)).toEqual({ streak: false, freezes: false, any: false, single: false });
    expect(profileWeekChips(null, null)).toEqual({ streak: false, freezes: false, any: false, single: false });
  });
  it('shows a streak above zero and freezes only when the count is known', () => {
    expect(profileWeekChips(12, 2)).toEqual({ streak: true, freezes: true, any: true, single: false });
    expect(profileWeekChips(12, null)).toEqual({ streak: true, freezes: false, any: true, single: true });
    expect(profileWeekChips(undefined, 0)).toEqual({ streak: false, freezes: true, any: true, single: true });
  });
});
