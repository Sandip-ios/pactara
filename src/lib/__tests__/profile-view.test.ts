import { describe, it, expect, vi } from 'vitest';
import { profileWeek, showProfileFreeze, memberSince, profileSetup, profileNudge, profileEditSchema, saveProfileFields } from '../profile-view';

describe('profile weekly day states', () => {
  const days = profileWeek({ today: '2026-11-27', checkIns: new Set(['2026-11-23']), covered: new Set(['2026-11-24']), missed: new Set(['2026-11-26']), workingOut: false });
  it('done', () => expect(days.find(d => d.date === '2026-11-23')?.state).toBe('done'));
  it('rest', () => expect(days.find(d => d.date === '2026-11-24')?.state).toBe('rest'));
  it('missed', () => expect(days.find(d => d.date === '2026-11-26')?.state).toBe('missed'));
  it('today', () => expect(days.find(d => d.date === '2026-11-27')?.state).toBe('today'));
  it('future', () => expect(days.find(d => d.date === '2026-11-28')?.state).toBe('future'));
  it('a freeze covers a previously missed day', () => {
    expect(profileWeek({ today: '2026-11-27', checkIns: new Set(), covered: new Set(['2026-11-26']), missed: new Set(['2026-11-26']), workingOut: false }).find(d => d.date === '2026-11-26')?.state).toBe('rest');
  });
});
describe('profile freeze visibility', () => {
  it('shows an eligible date within the current Monday to Sunday week with available freezes', () => expect(showProfileFreeze('2026-11-27', '2026-11-26', 2)).toBe(true));
  it('does not show with no freezes', () => expect(showProfileFreeze('2026-11-27', '2026-11-26', 0)).toBe(false));
  it('does not show without an eligible date', () => expect(showProfileFreeze('2026-11-27', null, 2)).toBe(false));
  it('does not show a last-week eligible date', () => expect(showProfileFreeze('2026-11-23', '2026-11-22', 2)).toBe(false));
});
describe('member since and setup', () => {
  it('formats profile creation month, not joining month', () => expect(memberSince('2026-09-01T00:00:00Z')).toBe('Member since Sep 2026'));
  it('does not invent a creation date', () => expect(memberSince(null)).toBeNull());
  it('joined only is 1 of 4, 25 percent', () => expect(profileSetup({ joined: true, photo: false, goal: false, checkIns: 0 })).toEqual({ rows: [true, false, false, false], done: 1, percent: 25, visible: true }));
  it('counts photo, goal and first check-in separately and hides only at four', () => {
    expect(profileSetup({ joined: true, photo: true, goal: true, checkIns: 0 }).done).toBe(3);
    expect(profileSetup({ joined: true, photo: true, goal: true, checkIns: 1 })).toEqual({ rows: [true, true, true, true], done: 4, percent: 100, visible: false });
  });
});
describe('profile nudge state', () => {
  it('allowed', () => expect(profileNudge({ blocked: false, covered: false, sent: false })).toBe('allowed'));
  it('nudged', () => expect(profileNudge({ blocked: false, covered: false, sent: true })).toBe('nudged'));
  it('covered wins over a prior nudge', () => expect(profileNudge({ blocked: false, covered: true, sent: true })).toBe('covered'));
  it('blocked either way hides it', () => expect(profileNudge({ blocked: true, covered: true, sent: true })).toBe('hidden'));
});
describe('profile edit saves', () => {
  const input = { name: 'José Togbe', goal: 'a'.repeat(120), groupId: '11111111-1111-4111-8111-111111111111' };
  it('accepts 120 goal characters', () => expect(profileEditSchema.safeParse(input).success).toBe(true));
  it('rejects 121 goal characters rather than silently truncating', () => expect(profileEditSchema.safeParse({ ...input, goal: 'a'.repeat(121) }).success).toBe(false));
  it('keeps existing name limits', () => {
    expect(profileEditSchema.safeParse({ ...input, name: ' ' }).success).toBe(false);
    expect(profileEditSchema.safeParse({ ...input, name: 'n'.repeat(81) }).success).toBe(false);
  });
  it('saves the goal for only the signed-in member and selected crew', async () => {
    const calls: unknown[][] = [];
    const db = { from: (table: string) => {
      const query = { select: vi.fn(() => query), update: vi.fn((fields: unknown) => { calls.push([table, 'update', fields]); return query; }), eq: vi.fn((key: string, value: string) => { calls.push([table, key, value]); return query; }), maybeSingle: vi.fn(async () => ({ data: { id: 'membership' }, error: null })), error: null };
      return query;
    }};
    await saveProfileFields(db, 'current-member', input);
    expect(calls).toContainEqual(['group_members', 'group_id', input.groupId]);
    expect(calls.filter(c => c[0] === 'group_members' && c[1] === 'user_id')).toEqual([['group_members', 'user_id', 'current-member'], ['group_members', 'user_id', 'current-member']]);
    expect(calls).toContainEqual(['group_members', 'update', expect.objectContaining({ personal_goal: 'a'.repeat(120) })]);
    expect(calls).toContainEqual(['profiles', 'id', 'current-member']);
  });
  it('does not write a goal when no crew is selected', async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ update: vi.fn(() => ({ eq })) }));
    await saveProfileFields({ from }, 'current-member', { ...input, groupId: null });
    expect(from).toHaveBeenCalledExactlyOnceWith('profiles');
  });
});