import { describe, expect, it, vi } from 'vitest';
import { runMealFoodWarm, WARM_TERMS_PER_RUN, WARM_HOURLY_REQUEST_LIMIT, WARM_REQUESTS_PER_SEARCH, type WarmDeps } from '../meal-food-warm';

function harness(rows: { term: string; version?: string; warmed?: boolean }[]) {
  const claimed = new Set<string>();
  const deps: WarmDeps = {
    claimTerm: vi.fn(async version => {
      const row = rows.find(r => (!r.warmed || r.version !== version) && !claimed.has(r.term));
      if (!row) return null;
      claimed.add(row.term); return row.term;
    }),
    search: vi.fn(async () => ({ error: false })),
    finish: vi.fn(async (term, version, success) => {
      const row = rows.find(r => r.term === term);
      if (row && success) { row.version = version; row.warmed = true; }
    }),
    remaining: async version => rows.filter(r => !r.warmed || r.version !== version).length,
    release: vi.fn(async () => {}), now: () => 1000, log: vi.fn(),
  };
  return deps;
}
describe('durable meal-food warmer', () => {
  it('picks unwarmed terms, skipping finished terms under the current search version', async () => {
    const deps = harness([{ term: 'eggs', warmed: true, version: 'v13' }, { term: 'oats' }]);
    expect(await runMealFoodWarm(deps, 'v13')).toMatchObject({ warmed: 1, remaining: 0, limited: false });
    expect(deps.search).toHaveBeenCalledExactlyOnceWith('oats');
    expect(deps.release).toHaveBeenCalledTimes(1);
  });
  it('stops immediately on budget refusal and leaves that term pending', async () => {
    const deps = harness([{ term: 'rice' }, { term: 'pasta' }]);
    vi.mocked(deps.search).mockResolvedValue({ error: false, incomplete: true, limited: true });
    expect(await runMealFoodWarm(deps, 'v13')).toMatchObject({ warmed: 0, remaining: 2, limited: true });
    expect(deps.search).toHaveBeenCalledExactlyOnceWith('rice');
    expect(deps.finish).toHaveBeenCalledWith('rice', 'v13', false, 'Hourly warming allowance reached');
  });
  it('rewarm terms automatically when the imported search version changes', async () => {
    const deps = harness([{ term: 'eggs', warmed: true, version: 'v12' }]);
    expect(await runMealFoodWarm(deps, 'v13')).toMatchObject({ warmed: 1, remaining: 0 });
    expect(deps.finish).toHaveBeenCalledWith('eggs', 'v13', true, null);
  });
  it('does no searches once every term is complete', async () => {
    const deps = harness([{ term: 'rice', warmed: true, version: 'v13' }]);
    expect(await runMealFoodWarm(deps, 'v13')).toMatchObject({ warmed: 0, remaining: 0 });
    expect(deps.search).not.toHaveBeenCalled();
  });
  it('bounds a run to 15 terms and 75 reserved calls, at most 300/hour over four runs', async () => {
    const deps = harness(Array.from({ length: 300 }, (_, i) => ({ term: `term ${i}` })));
    expect((await runMealFoodWarm(deps, 'v13')).warmed).toBe(15);
    expect(WARM_TERMS_PER_RUN * WARM_REQUESTS_PER_SEARCH * 4).toBe(WARM_HOURLY_REQUEST_LIMIT);
    expect(WARM_HOURLY_REQUEST_LIMIT).toBe(300);
  });
  it('keeps partial and failed terms pending, logs failure, continues and releases its lease', async () => {
    const deps = harness([{ term: 'rice' }, { term: 'pasta' }, { term: 'oats' }]);
    vi.mocked(deps.search).mockResolvedValueOnce({ error: false, incomplete: true }).mockRejectedValueOnce(new Error('Provider failed')).mockResolvedValueOnce({ error: false });
    expect(await runMealFoodWarm(deps, 'v13')).toMatchObject({ warmed: 1, remaining: 2 });
    expect(deps.log).toHaveBeenCalledExactlyOnceWith('pasta');
    expect(deps.release).toHaveBeenCalledTimes(1);
  });
});