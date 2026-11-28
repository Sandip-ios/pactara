/** Bounded orchestration; leases and atomic budget decisions belong to the database. */
export const WARM_TERMS_PER_RUN = 15;
export const WARM_REQUESTS_PER_SEARCH = 5;
export const WARM_HOURLY_REQUEST_LIMIT = 300;
export type WarmSearchResult = { incomplete?: boolean; limited?: boolean; error: boolean };
export type WarmDeps = {
  claimTerm: (version: string) => Promise<string | null>;
  search: (term: string) => Promise<WarmSearchResult>;
  finish: (term: string, version: string, success: boolean, error: string | null) => Promise<void>;
  release: () => Promise<void>;
  remaining: (version: string) => Promise<number>;
  now: () => number;
  log: (term: string) => void;
};
export async function runMealFoodWarm(deps: WarmDeps, version: string) {
  const started = deps.now();
  const terms: { term: string; ms: number; status: 'warmed' | 'partial' | 'limited' | 'error' }[] = [];
  let limited = false;
  try {
    for (let i = 0; i < WARM_TERMS_PER_RUN && deps.now() - started < 75000; i++) {
      const term = await deps.claimTerm(version);
      if (!term) break;
      const before = deps.now();
      try {
        const result = await deps.search(term);
        const success = !result.incomplete && !result.limited && !result.error;
        await deps.finish(term, version, success, success ? null : result.limited ? 'Hourly warming allowance reached' : 'Incomplete USDA response');
        terms.push({ term, ms: deps.now() - before, status: success ? 'warmed' : result.limited ? 'limited' : 'partial' });
        if (result.limited) { limited = true; break; }
      } catch {
        deps.log(term);
        await deps.finish(term, version, false, 'Search failed');
        terms.push({ term, ms: deps.now() - before, status: 'error' });
      }
    }
  } finally {
    await deps.release();
  }
  return { version, warmed: terms.filter(t => t.status === 'warmed').length, remaining: await deps.remaining(version), limited, terms, ms: deps.now() - started };
}