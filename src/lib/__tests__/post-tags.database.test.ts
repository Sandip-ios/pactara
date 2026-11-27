import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const base = 'http://127.0.0.1:8001';
type Account = { id: string; token: string };
const u: Record<'author' | 'crewmate' | 'followee' | 'blocked' | 'teen', Account> = {} as never;
const crews: string[] = [];
function key() { const k = process.env['SUPABASE_SERVICE_ROLE_KEY']; if (!k) throw new Error('Draft credentials missing'); return k; }
async function request<T>(path: string, token: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(base + path, { method, headers: { apikey: key(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await r.text();
  if (!r.ok) throw new Error((JSON.parse(text) as { message?: string }).message ?? 'Draft request failed');
  return (text ? JSON.parse(text) : null) as T;
}
const admin = <T>(path: string, method = 'GET', body?: unknown) => request<T>(path, key(), method, body);
const rpc = <T>(a: Account, fn: string, args: object) => request<T>(`/rest/v1/rpc/${fn}`, a.token, 'POST', args);
const tagIds = async (post: string) => (await admin<{ user_id: string }[]>(`/rest/v1/social_post_tags?post_id=eq.${post}`)).map(r => r.user_id).sort();
const create = (audience: string, groupIds: string[], tags: string[]) => rpc<string>(u.author, 'create_library_post_v2', { _caption: 'Temporary tag test', _audience: audience, _group_ids: groupIds, _items: [], _workout: null, _workout_session_id: null, _workout_id: null, _credit_user_id: null, _comments_on: true, _tags: tags, _skip_discover: false });

describe.skipIf(!process.env['PGHOST'] || !process.env['SUPABASE_SERVICE_ROLE_KEY'])('Post tags database rules', () => {
  beforeAll(async () => {
    for (const name of ['author', 'crewmate', 'followee', 'blocked', 'teen'] as const) {
      const email = `${randomUUID()}@example.com`; const password = randomUUID();
      const user = await admin<{ id: string }>('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true });
      const s = await request<{ access_token: string }>('/auth/v1/token?grant_type=password', key(), 'POST', { email, password });
      u[name] = { id: user.id, token: s.access_token };
      await admin(`/rest/v1/profiles?id=eq.${user.id}`, 'PATCH', { app_version: 'new', new_version_enabled: true, is_private: false, birthday: name === 'teen' ? '2012-01-01' : '1990-01-01', name: `Temp ${name}` });
    }
    for (let i = 0; i < 2; i++) {
      const g = (await admin<{ id: string }[]>('/rest/v1/groups', 'POST', { name: `Temporary tag crew ${i}`, owner_id: u.author.id }))[0]!.id; crews.push(g);
      await admin('/rest/v1/group_members?on_conflict=group_id,user_id', 'POST', { group_id: g, user_id: u.author.id }).catch(() => undefined);
    }
    await admin('/rest/v1/group_members', 'POST', [{ group_id: crews[0], user_id: u.crewmate.id }, { group_id: crews[0], user_id: u.blocked.id }]);
    await admin('/rest/v1/follows', 'POST', [{ follower_id: u.author.id, following_id: u.followee.id, status: 'accepted', accepted_at: new Date().toISOString() }, { follower_id: u.author.id, following_id: u.teen.id, status: 'accepted', accepted_at: new Date().toISOString() }]);
    await admin('/rest/v1/user_blocks', 'POST', { blocker_id: u.blocked.id, blocked_id: u.author.id });
  });
  afterAll(async () => {
    await admin(`/rest/v1/social_posts?user_id=eq.${u.author.id}`, 'DELETE');
    for (const g of crews) await admin(`/rest/v1/groups?id=eq.${g}`, 'DELETE');
    for (const a of Object.values(u)) { await admin(`/rest/v1/subscriptions?user_id=eq.${a.id}`, 'DELETE'); await admin(`/auth/v1/admin/users/${a.id}`, 'DELETE'); }
  });
  it('lists crewmates and followees for Everyone, only chosen crew members for Crews, never blocked or adult/teen pairs', async () => {
    const everyone = (await rpc<{ id: string; section: string }[]>(u.author, 'get_taggable_people', { _audience: 'everyone', _group_ids: [] })).map(p => p.id).sort();
    expect(everyone).toEqual([u.crewmate.id, u.followee.id].sort());
    const crewOnly = (await rpc<{ id: string }[]>(u.author, 'get_taggable_people', { _audience: 'crews', _group_ids: [crews[1]] })).map(p => p.id);
    expect(crewOnly).toEqual([]);
    expect((await rpc<{ id: string }[]>(u.author, 'get_taggable_people', { _audience: 'crews', _group_ids: [crews[0]] })).map(p => p.id)).toEqual([u.crewmate.id]);
    expect(await rpc(u.author, 'get_taggable_people', { _audience: 'only_me', _group_ids: [] })).toEqual([]);
  });
  it('drops tags the audience does not allow, at posting and after an audience change', async () => {
    const all = [u.crewmate.id, u.followee.id, u.blocked.id, u.teen.id];
    const id = await create('everyone', [], all);
    expect(await tagIds(id)).toEqual([u.crewmate.id, u.followee.id].sort());
    await rpc(u.author, 'set_social_post_audience', { _post_id: id, _audience: 'crews', _group_ids: [crews[0]] });
    expect(await tagIds(id)).toEqual([u.crewmate.id]);
  });
  it('notifies once per person per post; edits only notify newly added people; Remove me takes the tag off', async () => {
    const id = await create('everyone', [], [u.crewmate.id]);
    expect(await rpc<string[]>(u.author, 'claim_social_post_tag_pushes', { _post_id: id })).toEqual([u.crewmate.id]);
    expect(await rpc<string[]>(u.author, 'claim_social_post_tag_pushes', { _post_id: id })).toEqual([]);
    await rpc(u.author, 'set_social_post_tags', { _post_id: id, _tags: [u.crewmate.id, u.followee.id] });
    expect(await rpc<string[]>(u.author, 'claim_social_post_tag_pushes', { _post_id: id })).toEqual([u.followee.id]);
    await rpc(u.crewmate, 'remove_me_from_social_post', { _post_id: id });
    expect(await tagIds(id)).toEqual([u.followee.id]);
  });
});
