import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

const base = 'http://127.0.0.1:8001';
const createdIds: string[] = [];
const reportIds: string[] = [];
type Account = { id: string; token: string };
const service = () => {
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!key) throw new Error('Draft auth credentials unavailable');
  return key;
};
async function request<T>(path: string, token: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: service(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`Draft account deletion test request failed: ${response.status}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
const admin = <T>(path: string, method = 'GET', body?: unknown) => request<T>(path, service(), method, body);
const rows = (table: string, filter: string) => admin<Record<string, unknown>[]>(`/rest/v1/${table}?${filter}`);
async function makeAccount(version: 'classic' | 'new'): Promise<Account> {
  const email = `${randomUUID()}@example.com`;
  const password = randomUUID();
  const user = await admin<{ id: string }>('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true });
  createdIds.push(user.id);
  await admin(`/rest/v1/profiles?id=eq.${user.id}`, 'PATCH', { app_version: version, new_version_enabled: version === 'new' });
  const session = await request<{ access_token: string }>('/auth/v1/token?grant_type=password', service(), 'POST', { email, password });
  return { id: user.id, token: session.access_token };
}

// Real draft-local auth deletion exercises the same cascade used by deleteMyAccount.
// No production requests, emails or screenshots; remove retained test reports afterwards.
describe.skipIf(!process.env['PGHOST'] || !process.env['SUPABASE_SERVICE_ROLE_KEY'])('Account deletion safety history', () => {
  afterAll(async () => {
    for (const id of reportIds) await admin(`/rest/v1/content_reports?id=eq.${id}`, 'DELETE');
    for (const id of createdIds) {
      await admin(`/rest/v1/user_blocks?or=(blocker_id.eq.${id},blocked_id.eq.${id})`, 'DELETE');
      if ((await rows('profiles', `id=eq.${id}`)).length) await admin(`/auth/v1/admin/users/${id}`, 'DELETE');
    }
  });

  it.each(['classic', 'new'] as const)('deleting a %s account removes outgoing and incoming blocks but leaves the entire report unchanged', async version => {
    const deleted = await makeAccount(version);
    const outgoingTarget = await makeAccount('new');
    const reporter = await makeAccount('new');
    await request('/rest/v1/rpc/submit_content_report', reporter.token, 'POST', {
      _reported: deleted.id, _type: 'user', _target: null, _group: null,
      _reason: 'harassment', _details: 'Retained safety history test', _block: false,
    });
    const before = await rows('content_reports', `reported_user_id=eq.${deleted.id}`);
    expect(before).toHaveLength(1);
    const reportId = before[0]?.['id'];
    if (typeof reportId !== 'string') throw new Error('Test report missing');
    reportIds.push(reportId);
    await request('/rest/v1/user_blocks', deleted.token, 'POST', { blocker_id: deleted.id, blocked_id: outgoingTarget.id });
    await request('/rest/v1/user_blocks', reporter.token, 'POST', { blocker_id: reporter.id, blocked_id: deleted.id });
    const filter = `or=(blocker_id.eq.${deleted.id},blocked_id.eq.${deleted.id})`;
    expect(await rows('user_blocks', filter)).toHaveLength(2);

    await admin(`/auth/v1/admin/users/${deleted.id}`, 'DELETE');

    expect(await rows('profiles', `id=eq.${deleted.id}`)).toEqual([]);
    expect(await rows('user_blocks', filter)).toEqual([]);
    expect(await rows('content_reports', `id=eq.${reportId}`)).toEqual(before);
    expect(await rows('profiles', `id=in.(${outgoingTarget.id},${reporter.id})`)).toHaveLength(2);
  });
});