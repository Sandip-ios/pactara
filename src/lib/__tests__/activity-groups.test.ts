import { describe, expect, it } from 'vitest';
import { groupActivityRows, type ActivityRow } from '../activity-groups';

const now = new Date('2026-11-26T12:00:00Z');
function row(key: string, actorId: string, overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    key, kind: 'reaction', actorId, name: actorId.toUpperCase(), avatar: `${actorId}.jpg`, text: 'reacted 💪 to your check-in',
    createdAt: `2026-11-26T11:${key === 'late' ? '00' : '30'}:00Z`, read: true, groupId: 'crew', groupName: 'FitFam',
    postId: 'post-1', commentId: null, targetId: null, media: `${key}.jpg`, mediaKind: 'image', canFollow: false,
    canCheckIn: false, relationship: 'none', ...overrides,
  };
}

describe('new-version Activity grouping', () => {
  it('groups two people on one check-in, using the latest target and unread union', () => {
    const result = groupActivityRows([
      row('old', 'maya', { createdAt: '2026-11-26T10:00:00Z', read: true }),
      row('new', 'alex', { createdAt: '2026-11-26T11:00:00Z', read: false }),
    ], now);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: 'group:new|old', groupText: 'ALEX and MAYA reacted to your check-in', read: false, media: 'new.jpg' });
    expect(result[0]?.actors.map(actor => actor.id)).toEqual(['alex', 'maya']);
  });

  it('uses A and N others for three commenters', () => {
    const result = groupActivityRows(['a', 'b', 'c'].map((id, index) => row(id, id, { kind: 'comment', commentId: `comment-${id}`, createdAt: `2026-11-26T11:0${index}:00Z` })), now);
    expect(result[0]?.groupText).toBe('C and 2 others commented on your check-in');
    expect(result[0]?.commentId).toBe('comment-c');
  });

  it('groups one person across several of my check-ins and opens the latest', () => {
    const result = groupActivityRows([
      row('old', 'maya', { postId: 'post-old', createdAt: '2026-11-26T09:00:00Z' }),
      row('new', 'maya', { postId: 'post-new', createdAt: '2026-11-26T11:00:00Z' }),
    ], now);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ groupKind: 'posts', groupText: 'MAYA reacted to 2 of your check-ins', postId: 'post-new', media: 'new.jpg' });
  });

  it('targets the latest comment for a per-person multi-post group', () => {
    const result = groupActivityRows([
      row('old', 'maya', { kind: 'comment', text: 'commented on your check-in', postId: 'post-old', commentId: 'old-comment', createdAt: '2026-11-26T09:00:00Z' }),
      row('new', 'maya', { kind: 'comment', text: 'commented on your check-in', postId: 'post-new', commentId: 'new-comment', createdAt: '2026-11-26T11:00:00Z' }),
    ], now);
    expect(result[0]).toMatchObject({ groupText: 'MAYA commented on 2 of your check-ins', postId: 'post-new', commentId: 'new-comment' });
  });

  it('groups check-ins only within one crew and local day', () => {
    const result = groupActivityRows([
      row('a', 'a', { kind: 'checkin', text: 'checked in', postId: 'post-a', createdAt: '2026-11-26T11:00:00Z' }),
      row('b', 'b', { kind: 'checkin', text: 'checked in', postId: 'post-b', createdAt: '2026-11-26T10:00:00Z' }),
      row('c', 'c', { kind: 'checkin', text: 'checked in', postId: 'post-c', groupId: 'other', createdAt: '2026-11-26T09:00:00Z' }),
    ], now);
    expect(result).toHaveLength(2);
    expect(result[0]?.groupText).toBe('A and B checked in');
  });

  it('groups joins and pact signatures by crew and local day with crew destinations intact', () => {
    const result = groupActivityRows([
      row('join-a', 'a', { kind: 'join', text: 'joined FitFam', postId: null, createdAt: '2026-11-26T11:00:00Z' }),
      row('join-b', 'b', { kind: 'join', text: 'joined FitFam', postId: null, createdAt: '2026-11-26T10:00:00Z' }),
      row('pact-a', 'a', { kind: 'pact_signed', text: 'made the pact in FitFam', postId: null, createdAt: '2026-11-25T11:00:00Z' }),
      row('pact-b', 'b', { kind: 'pact_signed', text: 'made the pact in FitFam', postId: null, createdAt: '2026-11-25T10:00:00Z' }),
      row('pact-c', 'c', { kind: 'pact_signed', text: 'made the pact in FitFam', postId: null, groupId: 'other', groupName: 'Other', createdAt: '2026-11-25T09:00:00Z' }),
    ], now);
    expect(result.map(item => item.groupText)).toEqual(['A and B joined FitFam', 'A and B made the pact in FitFam', null]);
    expect(result[0]).toMatchObject({ kind: 'join', groupId: 'crew' });
    expect(result[1]).toMatchObject({ kind: 'pact_signed', groupId: 'crew' });
  });

  it('groups follows into a followers-list row with no single-target action', () => {
    const result = groupActivityRows([
      row('a', 'a', { kind: 'follow', text: 'started following you', postId: null, canFollow: true }),
      row('b', 'b', { kind: 'follow', text: 'started following you', postId: null, canFollow: true }),
    ], now);
    expect(result[0]).toMatchObject({ groupText: 'A and B started following you', canFollow: false, groupKind: 'people' });
  });

  it('never crosses sections or groups single-target request and reminder rows', () => {
    const result = groupActivityRows([
      row('request-a', 'a', { kind: 'crew_request', postId: null }),
      row('request-b', 'b', { kind: 'crew_request', postId: null }),
      row('follow-a', 'a', { kind: 'follow', postId: null, createdAt: '2026-11-20T11:00:00Z' }),
      row('follow-b', 'b', { kind: 'follow', postId: null }),
    ], now);
    expect(result).toHaveLength(4);
    expect(result.every(item => !item.grouped)).toBe(true);
  });

  it('does not combine repeated comments by one person on one check-in', () => {
    const result = groupActivityRows([
      row('a', 'maya', { kind: 'comment', text: 'commented on your check-in', commentId: 'one' }),
      row('b', 'maya', { kind: 'comment', text: 'commented on your check-in', commentId: 'two' }),
    ], now);
    expect(result).toHaveLength(2);
  });
});
