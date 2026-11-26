import { describe, expect, it } from 'vitest';
import { blockConfirmBody, followedByLine, memberFollowButton, memberProfileBody } from '../redesign-profile';
import { reportSchema } from '../safety-rules';

describe('someone else\'s profile (new version)', () => {
  it('picks the follow button', () => {
    expect(memberFollowButton('none', false, true)).toBe('follow');
    expect(memberFollowButton('follows_you', true, true)).toBe('follow_back');
    expect(memberFollowButton('requested', false, true)).toBe('requested');
    expect(memberFollowButton('following', true, true)).toBe('following');
    expect(memberFollowButton('none', false, false)).toBeNull();
    expect(memberFollowButton('blocked', false, true)).toBeNull();
  });
  it('shows the week card for crewmates and the private card otherwise', () => {
    expect(memberProfileBody({ relationship: 'none', isPrivate: true, sharedCrews: 1 })).toBe('week');
    expect(memberProfileBody({ relationship: 'none', isPrivate: true, sharedCrews: 0 })).toBe('private');
    expect(memberProfileBody({ relationship: 'requested', isPrivate: true, sharedCrews: 0 })).toBe('private');
    expect(memberProfileBody({ relationship: 'following', isPrivate: true, sharedCrews: 0 })).toBe('none');
    expect(memberProfileBody({ relationship: 'none', isPrivate: false, sharedCrews: 0 })).toBe('none');
    expect(memberProfileBody({ relationship: 'blocked', isPrivate: false, sharedCrews: 2 })).toBe('blocked');
  });
  it('words Followed by and the block body', () => {
    expect(followedByLine('Maya', 1)).toBe('Followed by Maya');
    expect(followedByLine('Maya', 4)).toBe('Followed by Maya and 3 others');
    expect(followedByLine(null, 0)).toBeNull();
    expect(blockConfirmBody('Maya', 'FitFam')).toContain("You'll both stay in FitFam.");
    expect(blockConfirmBody('Maya', null)).not.toContain('stay in');
  });
  it('allows a crewless report only for a profile', () => {
    const base = { reportedUserId: '00000000-0000-4000-8000-000000000001', targetId: null, reason: 'spam_or_fake' as const, details: '', alsoBlock: false };
    expect(reportSchema.safeParse({ ...base, targetType: 'user', groupId: null }).success).toBe(true);
    expect(reportSchema.safeParse({ ...base, targetType: 'post', targetId: '00000000-0000-4000-8000-000000000002', groupId: null }).success).toBe(false);
  });
});
