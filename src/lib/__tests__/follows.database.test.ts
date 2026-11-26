import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const base = 'http://127.0.0.1:8001';
type Account = { id: string; token: string };
let publicUser: Account | undefined;
let privateUser: Account | undefined;
const createdIds: string[] = [];
const creationPrivacy = new Map<string, unknown>();
const service = () => {
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!key) throw new Error('Draft auth credentials unavailable');
  return key;
};
async function request<T>(path: string, token: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method, headers: { apikey: service(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const error = await response.json() as { message?: string; msg?: string };
    throw new Error(error.message ?? error.msg ?? `Draft request failed: ${response.status}`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
const admin = <T>(path: string, method = 'GET', body?: unknown) => request<T>(path, service(), method, body);
const rpc = <T = Record<string, unknown>>(user: Account, fn: string, args: object) => request<T>(`/rest/v1/rpc/${fn}`, user.token, 'POST', args);
const rows = (table: string, filter: string) => admin<Record<string, unknown>[]>(`/rest/v1/${table}?${filter}`);
function accounts() {
  if (!publicUser || !privateUser) throw new Error('Test accounts unavailable');
  return { pub: publicUser, priv: privateUser };
}
const patchProfile = (id: string, fields: object) => admin(`/rest/v1/profiles?id=eq.${id}`, 'PATCH', fields);
const followRows = () => { const { pub, priv } = accounts(); return rows('follows', `follower_id=in.(${pub.id},${priv.id})`); };
const events = () => { const { pub, priv } = accounts(); return rows('follow_notifications', `actor_id=in.(${pub.id},${priv.id})`); };

// This test uses only the draft's local auth/Data API. Accounts and all rows
// are temporary, created at runtime and removed in afterAll; no saved data.
describe.skipIf(!process.env['PGHOST'] || !process.env['SUPABASE_SERVICE_ROLE_KEY'])('Redesign follows database rules', () => {
  beforeAll(async () => {
    const make = async (): Promise<Account> => {
      const email = `${randomUUID()}@example.com`;
      const password = randomUUID();
      const user = await admin<{ id: string }>('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true });
      createdIds.push(user.id);
      const profile = await rows('profiles', `id=eq.${user.id}&select=is_private`);
      creationPrivacy.set(user.id, profile[0]?.['is_private']);
      const session = await request<{ access_token: string }>('/auth/v1/token?grant_type=password', service(), 'POST', { email, password });
      return { id: user.id, token: session.access_token };
    };
    publicUser = await make();
    privateUser = await make();
  });
  beforeEach(async () => {
    const { pub, priv } = accounts();
    const ids = `in.(${pub.id},${priv.id})`;
    await admin(`/rest/v1/user_blocks?blocker_id=${ids}`, 'DELETE');
    await admin(`/rest/v1/follows?follower_id=${ids}`, 'DELETE');
    await admin(`/rest/v1/follow_notifications?actor_id=${ids}`, 'DELETE');
    await patchProfile(pub.id, { birthday: null, is_private: false, app_version: 'new', new_version_enabled: true });
    await patchProfile(priv.id, { birthday: null, is_private: true, app_version: 'new', new_version_enabled: true });
  });
  afterAll(async () => {
    // Run cleanup even if account creation or a test fails part-way through.
    const errors: string[] = [];
    for (const id of createdIds) {
      try {
        await admin(`/rest/v1/user_blocks?or=(blocker_id.eq.${id},blocked_id.eq.${id})`, 'DELETE');
        await admin(`/rest/v1/notification_reads?user_id=eq.${id}`, 'DELETE');
        await admin(`/rest/v1/subscriptions?user_id=eq.${id}`, 'DELETE');
        await admin(`/auth/v1/admin/users/${id}`, 'DELETE');
        expect(await rows('profiles', `id=eq.${id}`)).toEqual([]);
        expect(await rows('follows', `or=(follower_id.eq.${id},following_id.eq.${id})`)).toEqual([]);
        expect(await rows('follow_notifications', `or=(actor_id.eq.${id},recipient_id.eq.${id})`)).toEqual([]);
      } catch (error) { errors.push(error instanceof Error ? error.message : 'Cleanup failed'); }
    }
    if (errors.length) throw new Error(errors.join('; '));
  });
  it('keeps both new accounts private by default until they choose otherwise', async () => {
    for (const id of createdIds) {
      // Creation defaults were captured before beforeEach makes an explicit choice.
      expect(creationPrivacy.get(id)).toBe(true);
    }
  });
  it('refuses classic targets with the exact message and creates no follow or event', async () => {
    const { pub, priv } = accounts();
    await patchProfile(pub.id, { app_version: 'classic' });
    await expect(rpc(priv, 'follow_user', { target: pub.id })).rejects.toThrow("This person can't be followed yet");
    expect(await followRows()).toEqual([]);
    expect(await events()).toEqual([]);
    expect((await rpc(priv, 'get_profile', { target: pub.id }))['can_follow']).toBe(false);
    await patchProfile(pub.id, { app_version: 'new', new_version_enabled: false });
    await expect(rpc(priv, 'follow_user', { target: pub.id })).rejects.toThrow("This person can't be followed yet");
    expect((await rpc(priv, 'get_profile', { target: pub.id }))['can_follow']).toBe(false);
  });
  it('returns can_follow for new targets, but not yourself or either blocked direction', async () => {
    const { pub, priv } = accounts();
    expect((await rpc(pub, 'get_profile', { target: priv.id }))['can_follow']).toBe(true);
    expect((await rpc(priv, 'get_profile', { target: pub.id }))['can_follow']).toBe(true);
    expect((await rpc(pub, 'get_profile', { target: pub.id }))['can_follow']).toBe(false);
    await request('/rest/v1/user_blocks', priv.token, 'POST', { blocker_id: priv.id, blocked_id: pub.id });
    expect((await rpc(pub, 'get_profile', { target: priv.id }))['can_follow']).toBe(false);
    expect((await rpc(priv, 'get_profile', { target: pub.id }))['can_follow']).toBe(false);
  });
  it('preserves accepted and requested follows when the target switches to classic', async () => {
    const { pub, priv } = accounts();
    await rpc(priv, 'follow_user', { target: pub.id });
    await rpc(pub, 'follow_user', { target: priv.id });
    const before = await followRows();
    await patchProfile(pub.id, { app_version: 'classic' });
    await patchProfile(priv.id, { app_version: 'classic' });
    expect(await followRows()).toEqual(before);
    await expect(rpc(priv, 'follow_user', { target: pub.id })).rejects.toThrow("This person can't be followed yet");
    expect(await followRows()).toEqual(before);
    const profile = await rpc(priv, 'get_profile', { target: pub.id });
    expect(profile['relationship']).toBe('following');
    expect(profile['can_follow']).toBe(false);
  });
  it('accepts public follows idempotently and sets accepted_at', async () => {
    const { pub, priv } = accounts();
    expect(await rpc(priv, 'follow_user', { target: pub.id })).toEqual({ status: 'accepted', changed: true });
    expect(await rpc(priv, 'follow_user', { target: pub.id })).toEqual({ status: 'accepted', changed: false });
    expect((await followRows())[0]?.['accepted_at']).toEqual(expect.any(String));
    expect(await events()).toHaveLength(1);
  });
  it('requests private follows and only the followed person can accept', async () => {
    const { pub, priv } = accounts();
    expect(await rpc(pub, 'follow_user', { target: priv.id })).toEqual({ status: 'requested', changed: true });
    await rpc(pub, 'respond_follow_request', { follower: priv.id, accept: true });
    expect((await followRows())[0]?.['status']).toBe('requested');
    await rpc(priv, 'respond_follow_request', { follower: pub.id, accept: true });
    expect((await followRows())[0]?.['status']).toBe('accepted');
    expect((await events()).filter(row => row['kind'] === 'follow_accepted')).toHaveLength(1);
  });
  it('declines without sending an acceptance event', async () => {
    const { pub, priv } = accounts();
    await rpc(pub, 'follow_user', { target: priv.id });
    await rpc(priv, 'respond_follow_request', { follower: pub.id, accept: false });
    expect(await followRows()).toEqual([]);
    expect((await events()).filter(row => row['actor_id'] === priv.id)).toEqual([]);
  });
  it('allows only the followed person to remove a follower', async () => {
    const { pub, priv } = accounts();
    await rpc(priv, 'follow_user', { target: pub.id });
    await rpc(priv, 'remove_follower', { follower: pub.id });
    expect(await followRows()).toHaveLength(1);
    await rpc(pub, 'remove_follower', { follower: priv.id });
    expect(await followRows()).toEqual([]);
    expect(await events()).toHaveLength(1);
  });
  it('unfollows accepted and requested rows without new events', async () => {
    const { pub, priv } = accounts();
    await rpc(priv, 'follow_user', { target: pub.id });
    await rpc(priv, 'unfollow_user', { target: pub.id });
    await rpc(pub, 'follow_user', { target: priv.id });
    await rpc(pub, 'unfollow_user', { target: priv.id });
    expect(await followRows()).toEqual([]);
    expect(await events()).toHaveLength(2);
  });
  it('block removes both directions and refuses re-following in either direction', async () => {
    const { pub, priv } = accounts();
    await rpc(priv, 'follow_user', { target: pub.id });
    await rpc(pub, 'follow_user', { target: priv.id });
    await request('/rest/v1/user_blocks', priv.token, 'POST', { blocker_id: priv.id, blocked_id: pub.id });
    expect(await followRows()).toEqual([]);
    await expect(rpc(pub, 'follow_user', { target: priv.id })).rejects.toThrow('Interaction not allowed');
    await expect(rpc(priv, 'follow_user', { target: pub.id })).rejects.toThrow('Interaction not allowed');
    expect((await rpc(pub, 'get_profile', { target: priv.id }))['relationship']).toBe('blocked');
  });
  it('forces teen privacy on birthday updates and public toggles until the 18th birthday', async () => {
    const { pub } = accounts();
    const today = new Date();
    const born = (years: number) => new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);
    await patchProfile(pub.id, { birthday: born(17), is_private: false });
    await rpc(pub, 'set_profile_privacy', { private: false });
    expect((await rows('profiles', `id=eq.${pub.id}&select=is_private`))[0]?.['is_private']).toBe(true);
    await patchProfile(pub.id, { birthday: born(18) });
    await rpc(pub, 'set_profile_privacy', { private: false });
    expect((await rows('profiles', `id=eq.${pub.id}&select=is_private`))[0]?.['is_private']).toBe(false);
  });
  it('private to public accepts pending requests once', async () => {
    const { pub, priv } = accounts();
    await rpc(pub, 'follow_user', { target: priv.id });
    await rpc(priv, 'set_profile_privacy', { private: false });
    await rpc(priv, 'set_profile_privacy', { private: false });
    expect((await followRows())[0]?.['status']).toBe('accepted');
    expect((await events()).filter(row => row['kind'] === 'follow_accepted')).toHaveLength(1);
  });
  it('private lists require accepted following or self; public lists remain readable', async () => {
    const { pub, priv } = accounts();
    await rpc(priv, 'follow_user', { target: pub.id });
    expect(await rpc(pub, 'list_profile_follows', { target: priv.id, direction: 'following' })).toEqual([]);
    expect(await rpc(priv, 'list_profile_follows', { target: priv.id, direction: 'following' })).toHaveLength(1);
    await rpc(pub, 'follow_user', { target: priv.id });
    await rpc(priv, 'respond_follow_request', { follower: pub.id, accept: true });
    expect(await rpc(pub, 'list_profile_follows', { target: priv.id, direction: 'following' })).toHaveLength(1);
    expect(await rpc(priv, 'list_profile_follows', { target: pub.id, direction: 'followers' })).toHaveLength(1);
  });
  it('limits private profile fields and never returns birthday or email', async () => {
    const { pub, priv } = accounts();
    const limited = await rpc(pub, 'get_profile', { target: priv.id });
    expect(limited['shares_crew']).toBeUndefined();
    expect(limited['birthday']).toBeUndefined();
    expect(limited['email']).toBeUndefined();
    expect(limited['follower_count']).toBe(0);
    const own = await rpc(priv, 'get_profile', { target: priv.id });
    expect(own['shares_crew']).toBe(false);
    expect(own['birthday']).toBeUndefined();
  });
  it('refuses direct writes, self-follow and anonymous calls', async () => {
    const { pub, priv } = accounts();
    await expect(request('/rest/v1/follows', pub.token, 'POST', { follower_id: pub.id, following_id: priv.id, status: 'requested' })).rejects.toThrow();
    await rpc(pub, 'follow_user', { target: priv.id });
    await expect(request(`/rest/v1/follows?follower_id=eq.${pub.id}`, pub.token, 'PATCH', { status: 'accepted', accepted_at: new Date().toISOString() })).rejects.toThrow();
    await expect(request(`/rest/v1/follows?follower_id=eq.${pub.id}`, pub.token, 'DELETE')).rejects.toThrow();
    await expect(rpc(pub, 'follow_user', { target: pub.id })).rejects.toThrow();
    const anon = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!anon) throw new Error('Draft publishable key unavailable');
    await expect(request('/rest/v1/rpc/follow_user', anon, 'POST', { target: pub.id })).rejects.toThrow();
  });
  it('new-only notifications respect blocks and reuse existing read keys', async () => {
    const { pub, priv } = accounts();
    await rpc(priv, 'follow_user', { target: pub.id });
    const visible = await request<{ id: string }[]>('/rest/v1/follow_notifications?select=id', pub.token);
    expect(visible).toHaveLength(1);
    const event = visible[0];
    if (!event) throw new Error('Notification missing');
    await request('/rest/v1/notification_reads', pub.token, 'POST', { user_id: pub.id, item_key: `follow:${event.id}` });
    expect(await rows('notification_reads', `user_id=eq.${pub.id}`)).toHaveLength(1);
    await patchProfile(pub.id, { app_version: 'classic' });
    expect(await request('/rest/v1/follow_notifications', pub.token)).toEqual([]);
    await patchProfile(pub.id, { app_version: 'new' });
    await request('/rest/v1/user_blocks', pub.token, 'POST', { blocker_id: pub.id, blocked_id: priv.id });
    expect(await request('/rest/v1/follow_notifications', pub.token)).toEqual([]);
  });
  it('push claims are one-time, new-only and block-aware', async () => {
    const { pub, priv } = accounts();
    await rpc(priv, 'follow_user', { target: pub.id });
    await patchProfile(pub.id, { app_version: 'classic' });
    expect(await admin('/rest/v1/rpc/claim_follow_pushes', 'POST', { actor: priv.id })).toEqual([]);
    await patchProfile(pub.id, { app_version: 'new' });
    expect(await admin('/rest/v1/rpc/claim_follow_pushes', 'POST', { actor: priv.id })).toHaveLength(1);
    expect(await admin('/rest/v1/rpc/claim_follow_pushes', 'POST', { actor: priv.id })).toEqual([]);
    await rpc(pub, 'follow_user', { target: priv.id });
    await request('/rest/v1/user_blocks', pub.token, 'POST', { blocker_id: pub.id, blocked_id: priv.id });
    expect(await admin('/rest/v1/rpc/claim_follow_pushes', 'POST', { actor: pub.id })).toEqual([]);
    await expect(rpc(pub, 'claim_follow_pushes', { actor: pub.id })).rejects.toThrow();
  });
  it('rechecks stat visibility and does not expose raw activity to clients', async () => {
    const { pub, priv } = accounts();
    expect(await admin('/rest/v1/rpc/get_visible_follow_profile_stats', 'POST', { target: priv.id, viewer: pub.id })).toBeNull();
    await rpc(pub, 'follow_user', { target: priv.id });
    await rpc(priv, 'respond_follow_request', { follower: pub.id, accept: true });
    const stats = await admin<Record<string, unknown>>('/rest/v1/rpc/get_visible_follow_profile_stats', 'POST', { target: priv.id, viewer: pub.id });
    expect(stats['badge_count']).toBe(0);
    await expect(rpc(pub, 'get_visible_follow_profile_stats', { target: priv.id, viewer: pub.id })).rejects.toThrow();
    await request('/rest/v1/user_blocks', priv.token, 'POST', { blocker_id: priv.id, blocked_id: pub.id });
    expect(await admin('/rest/v1/rpc/get_visible_follow_profile_stats', 'POST', { target: priv.id, viewer: pub.id })).toBeNull();
  });
  it('checks global username uniqueness without exposing identity, permits your own name and rejects anonymous checks', async () => {
    const { pub, priv } = accounts();
    const username = `qa.${randomUUID().replaceAll('-', '').slice(0, 15)}`;
    await patchProfile(pub.id, { username });
    expect(await rpc(pub, 'is_profile_username_available', { candidate: username })).toBe(true);
    expect(await rpc(priv, 'is_profile_username_available', { candidate: username })).toBe(false);
    expect(await rpc(priv, 'is_profile_username_available', { candidate: `${username}_free` })).toBe(true);
    expect(await rpc(priv, 'is_profile_username_available', { candidate: 'ab' })).toBe(false);
    await expect(request(`/rest/v1/profiles?id=eq.${priv.id}`, priv.token, 'PATCH', { username })).rejects.toThrow();
    const anon = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!anon) throw new Error('Draft publishable key unavailable');
    await expect(request('/rest/v1/rpc/is_profile_username_available', anon, 'POST', { candidate: username })).rejects.toThrow();
  });
  it('counts accepted rows only and resolves username as well as id', async () => {
    const { pub, priv } = accounts();
    const username = `qa.${randomUUID().replaceAll('-', '').slice(0, 15)}`;
    await patchProfile(priv.id, { username });
    await rpc(pub, 'follow_user', { target: priv.id });
    expect((await rpc(pub, 'get_profile', { target: username }))['follower_count']).toBe(0);
    await rpc(priv, 'respond_follow_request', { follower: pub.id, accept: true });
    expect((await rpc(pub, 'get_profile', { target: username }))['follower_count']).toBe(1);
    expect((await rpc(pub, 'get_profile', { target: pub.id }))['following_count']).toBe(1);
  });
});
