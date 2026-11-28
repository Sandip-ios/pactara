/** Bounded orchestration; leases and atomic budget decisions belong to the database. */
export const WARM_TERMS_PER_RUN = 15;
export const WARM_REQUESTS_PER_SEARCH = 5;
export const WARM_HOURLY_REQUEST_LIMIT = 300;
export const WARM_USDA_TIMEOUT_MS = 25000;
export const WARM_RETRY_BACKOFF_MS = 1000;
export type WarmSearchResult = { incomplete?: boolean; limited?: boolean; error: boolean };
function warmBackoff(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
/** Retry a partial/failed background pipeline once. Each attempt claims its own budget. */
export async function retryMealFoodWarm<T extends WarmSearchResult>(search: () => Promise<T>, signal: AbortSignal, backoff = warmBackoff): Promise<T> {
  try {
    const result = await search();
    if (result.limited || (!result.incomplete && !result.error)) return result;
  } catch (error) {
    if (signal.aborted) throw error;
  }
  signal.throwIfAborted();
  await backoff(WARM_RETRY_BACKOFF_MS, signal);
  signal.throwIfAborted();
  return search();
}
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