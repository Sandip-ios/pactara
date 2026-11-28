import { timingSafeEqual } from 'node:crypto';
import { FOOD_SEARCH_VERSION, remoteMealFoods } from './meal-food-search.server';
import { runMealFoodWarm, retryMealFoodWarm, WARM_REQUESTS_PER_SEARCH, WARM_USDA_TIMEOUT_MS } from './meal-food-warm';
import terms from './common-meal-food-terms.json';

/** Unlike the legacy reminders' public apikey, this hook requires a private, per-database job token. */
export async function handleMealFoodWarm(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await admin.from('meal_food_warm_control').select('token').eq('id', true).single();
  if (error || !data) return Response.json({ ok: false, error: 'Warming configuration unavailable' }, { status: 503 });
  const supplied = new TextEncoder().encode(auth.slice(7));
  const expected = new TextEncoder().encode(data.token);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const claim = await admin.rpc('claim_meal_food_warm_run', { _token: auth.slice(7), _terms: terms });
    if (claim.error) throw new Error('Could not claim warming run');
    const lease = claim.data;
    if (!lease) return Response.json({ ok: true, busy: true });
    // Bound the whole invocation below pg_net's existing 120s response timeout.
    const runSignal = AbortSignal.timeout(100000);
    const result = await runMealFoodWarm({
      claimTerm: async version => {
        const r = await admin.rpc('claim_meal_food_warm_term', { _version: version, _lease: lease });
        if (r.error) throw new Error('Could not claim term');
        return r.data;
      },
      search: term => retryMealFoodWarm(async () => {
        const signal = runSignal;
        const r = await remoteMealFoods(admin, term, false, signal, async () => {
          const claim = await admin.rpc('claim_meal_usda_warm_search', { _requests: WARM_REQUESTS_PER_SEARCH }).abortSignal(signal);
          if (claim.error) throw new Error('Could not reserve warming allowance');
          return claim.data;
        }, WARM_USDA_TIMEOUT_MS);
        // A term is complete only when the normal pipeline's current-version list is persisted.
        if (!r.incomplete && !r.limited && !r.error) {
          const saved = await admin.from('meal_food_searches').select('query').eq('query', `${FOOD_SEARCH_VERSION}:${term}`).abortSignal(signal).maybeSingle();
          if (saved.error || !saved.data) return { ...r, incomplete: true };
        }
        return r;
      }, runSignal),
      finish: async (term, version, success, error) => {
        const r = await admin.rpc('finish_meal_food_warm_term', { _term: term, _version: version, _lease: lease, _success: success, _error: error ?? '' });
        if (r.error) throw new Error('Could not record warming result');
      },
      release: async () => {
        const r = await admin.rpc('release_meal_food_warm_run', { _lease: lease });
        if (r.error) throw new Error('Could not release warming run');
      },
      remaining: async version => {
        const r = await admin.from('meal_food_warm_terms').select('term', { count: 'exact', head: true }).or(`warmed_at.is.null,version.neq.${version}`);
        if (r.error) throw new Error('Could not read warming progress');
        return r.count ?? terms.length;
      },
      now: () => Date.now(),
      log: term => console.warn('[warm-foods] term failed', term),
    }, FOOD_SEARCH_VERSION);
    console.info('[warm-foods]', JSON.stringify(result));
    return Response.json({ ok: true, ...result });
  } catch {
    // Cron receives a normal response; expired leases recover interrupted runs automatically.
    console.warn('[warm-foods] run failed; will retry on next scheduled invocation');
    return Response.json({ ok: false, retry: true });
  }
}