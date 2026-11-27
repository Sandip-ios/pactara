import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const base = 'http://127.0.0.1:8001';
type Account = { id: string; token: string };
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
const as = <T>(user: Account, path: string, method = 'GET', body?: unknown) => request<T>(path, user.token, method, body);

let author: Account | undefined;
let fan: Account | undefined;
const ids = { group: '', otherGroup: '', post: '', first: '', second: '', foreign: '' };
const users = () => { if (!author || !fan) throw new Error('Test accounts unavailable'); return { author, fan }; };

// Draft-only: temporary accounts, crew and rows are created here and removed in afterAll.
describe.skipIf(!process.env['PGHOST'] || !process.env['SUPABASE_SERVICE_ROLE_KEY'])('Per check-in cheers and replies', () => {
  beforeAll(async () => {
    const make = async (): Promise<Account> => {
      const email = `${randomUUID()}@example.com`;
      const password = randomUUID();
      const user = await admin<{ id: string }>('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true });
      const session = await request<{ access_token: string }>('/auth/v1/token?grant_type=password', service(), 'POST', { email, password });
      return { id: user.id, token: session.access_token };
    };
    author = await make();
    fan = await make();
    const [g] = await admin<{ id: string }[]>('/rest/v1/groups', 'POST', { name: 'Cheer test crew', owner_id: author.id });
    const [g2] = await admin<{ id: string }[]>('/rest/v1/groups', 'POST', { name: 'Other test crew', owner_id: author.id });
    ids.group = g!.id; ids.otherGroup = g2!.id;
    await admin('/rest/v1/group_members', 'POST', [
      { group_id: ids.group, user_id: author.id }, { group_id: ids.group, user_id: fan.id }, { group_id: ids.otherGroup, user_id: author.id },
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const cis = await admin<{ id: string }[]>('/rest/v1/check_ins', 'POST', [
      { user_id: author.id, group_id: ids.group, checkin_date: today, created_at: new Date(Date.now() - 60_000).toISOString() },
      { user_id: author.id, group_id: ids.group, checkin_date: today, created_at: new Date().toISOString() },
      { user_id: author.id, group_id: ids.otherGroup, checkin_date: today, created_at: new Date().toISOString() },
    ]);
    ids.first = cis[0]!.id; ids.second = cis[1]!.id; ids.foreign = cis[2]!.id;
    const [p] = await admin<{ id: string }[]>(`/rest/v1/daily_posts?on_conflict=user_id,group_id,local_date`, 'POST', { user_id: author.id, group_id: ids.group, local_date: today, check_in_id: ids.first });
    ids.post = p!.id;
  });

  afterAll(async () => {
    for (const g of [ids.group, ids.otherGroup].filter(Boolean)) await admin(`/rest/v1/groups?id=eq.${g}`, 'DELETE').catch(() => {});
    for (const u of [author, fan]) if (u) await admin(`/auth/v1/admin/users/${u.id}`, 'DELETE').catch(() => {});
  });

  it('lets a crewmate cheer the first (unscoped) and a later check-in on the same day', async () => {
    const { fan } = users();
    await as(fan, '/rest/v1/post_reactions', 'POST', { post_id: ids.post, user_id: fan.id, emoji: '🔥' });
    await as(fan, '/rest/v1/post_reactions', 'POST', { post_id: ids.post, user_id: fan.id, emoji: '🔥', check_in_id: ids.second });
    const rows = await admin<{ check_in_id: string | null }[]>(`/rest/v1/post_reactions?post_id=eq.${ids.post}&select=check_in_id`);
    expect(rows.map((r) => r.check_in_id).sort()).toEqual([ids.second, null].sort());
  });

  it('still allows only one cheer per person per check-in', async () => {
    const { fan } = users();
    await expect(as(fan, '/rest/v1/post_reactions', 'POST', { post_id: ids.post, user_id: fan.id, emoji: '🔥', check_in_id: ids.second })).rejects.toThrow();
    await expect(as(fan, '/rest/v1/post_reactions', 'POST', { post_id: ids.post, user_id: fan.id, emoji: '🔥' })).rejects.toThrow();
  });

  it('rejects a cheer or reply pointing at a check-in from another crew', async () => {
    const { fan } = users();
    await expect(as(fan, '/rest/v1/post_reactions', 'POST', { post_id: ids.post, user_id: fan.id, emoji: '👏', check_in_id: ids.foreign })).rejects.toThrow();
    await expect(as(fan, '/rest/v1/post_comments', 'POST', { post_id: ids.post, user_id: fan.id, body: 'Nice', check_in_id: ids.foreign })).rejects.toThrow();
  });

  it('stores a reply on the later check-in it was written on', async () => {
    const { fan } = users();
    const [c] = await as<{ check_in_id: string | null }[]>(fan, '/rest/v1/post_comments', 'POST', { post_id: ids.post, user_id: fan.id, body: 'Strong', check_in_id: ids.second });
    expect(c!.check_in_id).toBe(ids.second);
  });

  it('removes a later check-in’s cheers and replies with it, leaving the first card’s', async () => {
    await admin(`/rest/v1/check_ins?id=eq.${ids.second}`, 'DELETE');
    const reactions = await admin<{ check_in_id: string | null }[]>(`/rest/v1/post_reactions?post_id=eq.${ids.post}&select=check_in_id`);
    expect(reactions).toEqual([{ check_in_id: null }]);
    const comments = await admin<unknown[]>(`/rest/v1/post_comments?post_id=eq.${ids.post}&check_in_id=not.is.null`);
    expect(comments).toHaveLength(0);
  });
});
