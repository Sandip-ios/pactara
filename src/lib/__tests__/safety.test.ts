import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { blockedPairs, requireInteraction, submitReport } from '../safety.server';
import { visibleTo, visiblePost, reportSchema, reportAge, type SafetyReport } from '../safety-rules';
import { nudgeDecision } from '../nudge-rules';

const reporter = '11111111-1111-4111-8111-111111111111';
const reported = '22222222-2222-4222-8222-222222222222';
const group = '33333333-3333-4333-8333-333333333333';
const post = '44444444-4444-4444-8444-444444444444';
const report: SafetyReport = { reportedUserId: reported, targetType: 'post', targetId: post, groupId: group, reason: 'inappropriate_media', details: '', alsoBlock: false };

function database(author = reported, blocked: string[] = [reported]) {
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: { user_id: author }, error: null })) };
  const rpc = vi.fn(async (name: string) => ({ data: name === 'safety_blocked_pairs' ? blocked.map(user_id => ({ user_id })) : null, error: null }));
  const from = vi.fn(() => query);
  return { db: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe('bilateral member safety', () => {
  it('blockedPairs requests both directions through the authenticated lookup', async () => {
    const d = database(reported, ['blocked-by-me', 'blocked-me']);
    expect(await blockedPairs(d.db, reporter)).toEqual(new Set(['blocked-by-me', 'blocked-me']));
    expect(d.rpc).toHaveBeenCalledExactlyOnceWith('safety_blocked_pairs', { _user_id: reporter });
  });
  it('fails closed when the blocked-pairs query fails', async () => {
    const db = { rpc: vi.fn(async () => ({ data: null, error: { message: 'offline' } })) } as unknown as SupabaseClient;
    await expect(blockedPairs(db, reporter)).rejects.toThrow('Could not load privacy settings');
  });
  for (const surface of ['feed', 'comments', 'chat']) {
    it(`${surface} filters blocked authors in both directions and preserves others`, async () => {
      const blocked = await blockedPairs(database(reported, ['blocked-by-me', 'blocked-me']).db, reporter);
      const rows = [{ id: 'a', userId: 'blocked-by-me' }, { id: 'b', userId: 'blocked-me' }, { id: 'c', userId: 'other' }, { id: 'd', userId: reporter }];
      expect(visibleTo(rows, blocked, r => r.userId).map(r => r.id)).toEqual(['c', 'd']);
    });
  }
  it('rejects commenting on a blocked member post', async () => {
    await expect(requireInteraction(database().db, reporter, 'daily_posts', post)).rejects.toThrow('Interaction not allowed');
  });
  it('rejects new reactions on a blocked member post', async () => {
    await expect(requireInteraction(database().db, reporter, 'daily_posts', post)).rejects.toThrow('Interaction not allowed');
  });
  it('rejects replies and likes on a blocked member comment', async () => {
    await expect(requireInteraction(database().db, reporter, 'post_comments', post)).rejects.toThrow('Interaction not allowed');
  });
  it('allows interaction when there is no block', async () => {
    await expect(requireInteraction(database(reported, []).db, reporter, 'daily_posts', post)).resolves.toBeUndefined();
  });
  it('returns the not-allowed nudge result for a blocked pair', () => {
    expect(nudgeDecision({ firstName: 'Maya', alreadyNudgedToday: false, targetCoveredToday: false, blocked: true })).toEqual({ ok: false, reason: 'not_allowed', message: 'Nudge not allowed' });
  });
  it('hiding a post only affects the hider, not another viewer or another post', () => {
    const hidden = [{ user_id: reporter, post_id: post }];
    expect(visiblePost(reporter, post, hidden)).toBe(false);
    expect(visiblePost(reported, post, hidden)).toBe(true);
    expect(visiblePost(reporter, 'another-post', hidden)).toBe(true);
  });
  it('inserts a report through the atomic report/block RPC with its real target', async () => {
    const d = database();
    await submitReport(d.db, { ...report, reason: 'harassment', details: 'Unwanted comment', alsoBlock: true });
    expect(d.rpc).toHaveBeenCalledExactlyOnceWith('submit_content_report', { _reported: reported, _type: 'post', _target: post, _group: group, _reason: 'harassment', _details: 'Unwanted comment', _block: true });
  });
  it('a member report uses a null target and the selected member', async () => {
    const d = database();
    await submitReport(d.db, { ...report, targetType: 'user', targetId: null });
    expect(d.rpc).toHaveBeenCalledWith('submit_content_report', expect.objectContaining({ _reported: reported, _type: 'user', _target: null }));
  });
  it('allows 500 detail characters and rejects 501', () => {
    expect(reportSchema.safeParse({ ...report, details: 'a'.repeat(500) }).success).toBe(true);
    expect(reportSchema.safeParse({ ...report, details: 'a'.repeat(501) }).success).toBe(false);
  });
  it('rejects unknown reasons and missing post/comment targets', () => {
    expect(reportSchema.safeParse({ ...report, reason: 'made_up' }).success).toBe(false);
    expect(reportSchema.safeParse({ ...report, targetId: null }).success).toBe(false);
  });
  it('flags open reports older than 48 hours', () => {
    const created = '2026-11-23T03:00:00Z';
    expect(reportAge(created, Date.parse('2026-11-25T03:00:00Z'))).toEqual({ hours: 48, overdue: false });
    expect(reportAge(created, Date.parse('2026-11-25T04:00:00Z'))).toEqual({ hours: 49, overdue: true });
  });
});