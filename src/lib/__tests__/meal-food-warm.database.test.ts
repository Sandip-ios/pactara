import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const base = 'http://127.0.0.1:8001/rest/v1/';
async function admin<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!key) throw new Error('Draft admin credential unavailable');
  const r = await fetch(base + path, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!r.ok) throw new Error(`Draft warming test request failed (${r.status})`);
  const text = await r.text(); return text ? JSON.parse(text) as T : null as T;
}
const rpc = <T,>(name: string, body: unknown) => admin<T>(`rpc/${name}`, 'POST', body);

describe.skipIf(!process.env['PGHOST'] || !process.env['SUPABASE_SERVICE_ROLE_KEY'])('atomic warming leases and budget', () => {
  let lease: string | null = null;
  let token = '';
  let terms: string[] = [];
  let createdControl = false;
  beforeAll(async () => {
    const config = await admin<{ token: string }[]>('meal_food_warm_control?select=token');
    if (!config.length) {
      await admin('meal_food_warm_control', 'POST', { id: true });
      createdControl = true;
    }
  });
  afterAll(async () => {
    if (createdControl) await admin('meal_food_warm_control?id=eq.true', 'DELETE');
  });
  beforeEach(async () => {
    terms = [randomUUID(), randomUUID()].map(id => `warm-test-${id}`);
    const config = await admin<{ token: string }[]>('meal_food_warm_control?select=token');
    token = config[0]?.token ?? '';
    if (!token) throw new Error('No warming control row');
    lease = await rpc<string | null>('claim_meal_food_warm_run', { _token: token, _terms: terms });
    if (!lease) throw new Error('Warming lease already held');
    await admin(`meal_food_warm_terms?term=in.(${terms.join(',')})`, 'PATCH', { ordinal: -1000, attempted_at: null });
  });
  afterEach(async () => {
    await admin(`meal_food_warm_terms?term=in.(${terms.join(',')})`, 'DELETE');
    if (lease) await rpc('release_meal_food_warm_run', { _lease: lease });
  });
  it('picks an unwarmed term and rejects an overlapping run', async () => {
    const picked = await rpc<string>('claim_meal_food_warm_term', { _version: 'v13', _lease: lease });
    expect(terms).toContain(picked);
    expect(await rpc('claim_meal_food_warm_run', { _token: token, _terms: terms })).toBeNull();
    expect(await rpc('claim_meal_food_warm_term', { _version: 'v13', _lease: randomUUID() })).toBeNull();
    const next = await rpc<string>('claim_meal_food_warm_term', { _version: 'v13', _lease: lease });
    expect(terms).toContain(next); expect(next).not.toBe(picked);
  });
  it('a completed current-version term is skipped but a new version reclaims it', async () => {
    await admin(`meal_food_warm_terms?term=in.(${terms.join(',')})`, 'PATCH', { warmed_at: new Date().toISOString(), version: 'v13', attempted_at: null });
    const current = await rpc<string | null>('claim_meal_food_warm_term', { _version: 'v13', _lease: lease });
    expect(terms).not.toContain(current);
    if (current) await rpc('finish_meal_food_warm_term', { _term: current, _version: 'v13', _lease: lease, _success: false, _error: '' });
    const changed = await rpc<string>('claim_meal_food_warm_term', { _version: 'v14', _lease: lease });
    expect(terms).toContain(changed);
  });
  it('refuses warming past 300 shared calls without reserving the user half', async () => {
    const hour = new Date(); hour.setUTCMinutes(0, 0, 0);
    const filter = `hour=eq.${encodeURIComponent(hour.toISOString())}`;
    const old = await admin<{ hour: string; requests: number }[]>(`meal_usda_budget?${filter}`);
    const oldWarm = await admin<{ hour: string; requests: number }[]>(`meal_usda_warm_budget?${filter}`);
    try {
      await admin(`meal_usda_budget?${filter}`, 'DELETE');
      await admin('meal_usda_budget', 'POST', { hour: hour.toISOString(), requests: 295 });
      await admin(`meal_usda_warm_budget?${filter}`, 'DELETE');
      await admin('meal_usda_warm_budget', 'POST', { hour: hour.toISOString(), requests: 0 });
      expect(await rpc('claim_meal_usda_warm_search', { _requests: 5 })).toBe(true);
      expect(await rpc('claim_meal_usda_warm_search', { _requests: 5 })).toBe(false);
      expect((await admin<{ requests: number }[]>(`meal_usda_budget?${filter}`))[0]?.requests).toBe(300);
      expect(await rpc('claim_meal_usda_search', { _requests: 5 })).toBe(true);
      expect((await admin<{ requests: number }[]>(`meal_usda_budget?${filter}`))[0]?.requests).toBe(305);
    } finally {
      await admin(`meal_usda_budget?${filter}`, 'DELETE');
      await admin(`meal_usda_warm_budget?${filter}`, 'DELETE');
      if (old.length) await admin('meal_usda_budget', 'POST', old);
      if (oldWarm.length) await admin('meal_usda_warm_budget', 'POST', oldWarm);
    }
  });
});