import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { remoteMealFoods } from '../meal-food-search.server';
import { retryMealFoodWarm } from '../meal-food-warm';

beforeEach(() => {
  vi.useFakeTimers(); vi.stubEnv('USDA_API_KEY', 'test-only');
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
    return controller.signal;
  });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function adminMock() {
  let cache: { food_ids: string[] } | null = null;
  const writes: { table: string; value: unknown }[] = [];
  const builder = (result: unknown) => {
    const b: Record<string, unknown> = { then: (resolve: (r: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    for (const method of ['select', 'eq', 'in', 'is', 'abortSignal', 'maybeSingle']) b[method] = () => b;
    return b;
  };
  const from = (table: string) => {
    const b = builder({ data: table === 'meal_food_searches' ? cache : [], error: null });
    b['upsert'] = (value: unknown) => {
      writes.push({ table, value });
      if (table === 'meal_food_searches') cache = value as { food_ids: string[] };
      return b;
    };
    return b;
  };
  const rpc = vi.fn(() => builder({ data: true, error: null }));
  return { admin: { from, rpc } as unknown as SupabaseClient, writes, rpc };
}
const searchResponse = () => new Response(JSON.stringify({ foods: [{ fdcId: 1, description: 'Milk', dataType: 'SR Legacy' }] }));
const detailResponse = () => new Response(JSON.stringify([{ fdcId: 1, foodPortions: [{ modifier: 'cup', gramWeight: 244 }] }]));

describe('background deadline isolation and partial-cache protection', () => {
  it('reserves background budget again for its single retry, with no completed partial list', async () => {
    const { admin, writes, rpc } = adminMock();
    let searches = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (!url.endsWith('foods/search')) return detailResponse();
      searches++;
      const body = JSON.parse(String(init.body));
      if (searches <= 3 && body.dataType[0] === 'Branded') throw new DOMException('Timed out', 'TimeoutError');
      return searchResponse();
    }));
    const claim = vi.fn(async () => true);
    const backoff = vi.fn(async () => {});
    const signal = new AbortController().signal;
    expect(await retryMealFoodWarm(() => remoteMealFoods(admin, 'milk', false, signal, claim, 25000), signal, backoff)).toMatchObject({ incomplete: false });
    expect(searches).toBe(6); expect(claim).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalled(); expect(backoff).toHaveBeenCalledExactlyOnceWith(1000, signal);
    expect(writes.filter(w => w.table === 'meal_food_searches')).toHaveLength(1);
  });
  it('allows background searches and details to each take over four seconds', async () => {
    const { admin, writes, rpc } = adminMock();
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      setTimeout(() => resolve(url.endsWith('foods/search') ? searchResponse() : detailResponse()), 5000);
    })));
    const claim = vi.fn(async () => true);
    const pending = remoteMealFoods(admin, 'milk', false, new AbortController().signal, claim, 25000);
    await vi.advanceTimersByTimeAsync(10000);
    expect(await pending).toMatchObject({ incomplete: false, cached: false });
    expect(writes.filter(w => w.table === 'meal_food_searches')).toHaveLength(1);
    expect(claim).toHaveBeenCalledTimes(1); expect(rpc).not.toHaveBeenCalled();
    expect(AbortSignal.timeout).toHaveBeenCalledWith(25000);
    expect(AbortSignal.timeout).not.toHaveBeenCalledWith(4000);
  });
  it('times out hung background USDA calls at 25 seconds without writing a complete list', async () => {
    const { admin, writes } = adminMock();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    })));
    let done = false;
    const pending = remoteMealFoods(admin, 'milk', false, new AbortController().signal, async () => true, 25000).then(r => { done = true; return r; });
    await vi.advanceTimersByTimeAsync(24999); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ incomplete: true });
    expect(writes.filter(w => w.table === 'meal_food_searches')).toHaveLength(0);
  });
  it('retains four-second user timeout, never completes a partial cache, and searches USDA again next time', async () => {
    const { admin, writes, rpc } = adminMock();
    let slow = true; let searches = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (!url.endsWith('foods/search')) return detailResponse();
      searches++;
      const body = JSON.parse(String(init.body));
      if (slow && body.dataType[0] === 'Branded') return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
      return searchResponse();
    }));
    const first = remoteMealFoods(admin, 'milk', false, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await first).toMatchObject({ incomplete: true, cached: false });
    expect(writes.filter(w => w.table === 'meal_food_searches')).toHaveLength(0);
    slow = false;
    expect(await remoteMealFoods(admin, 'milk', false, new AbortController().signal)).toMatchObject({ incomplete: false, cached: false });
    expect(searches).toBe(6); expect(rpc).toHaveBeenCalledTimes(2);
    expect(writes.filter(w => w.table === 'meal_food_searches')).toHaveLength(1);
  });
});