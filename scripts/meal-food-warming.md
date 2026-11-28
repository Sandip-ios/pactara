# Durable food-cache warming

Accepting brings migration 0120's progress tables, leases, private job credential and budget RPCs into the app, including the singleton `meal_food_warm_control` token row. Draft cached foods and progress never copy to production. Publishing deploys `/api/public/hooks/warm-foods`, but **does not register the production schedule**. After accepting and publishing, run `scripts/schedule-meal-food-warming.sql` against production as the database owner (or a role permitted to manage cron and read the token row). That SQL is the only remaining activation step; no secret needs to be copied or configured manually. Production's `pg_cron` and `pg_net` extensions were both confirmed enabled, and the published origin is `https://pactara.lovable.app`. The SQL has not been executed by this draft.

Once activated, `warm-meal-foods` calls the published hook at UTC minutes 0, 15, 30 and 45 (96 daily). Each run claims a five-minute global lease and up to 15 unwarmed terms with `FOR UPDATE SKIP LOCKED`, oldest unattempted first. Finished current-version caches count as complete without USDA calls. Failed/partial terms stay pending and rotate behind unattempted terms. Each normal search reserves five requests atomically against the shared allowance; warming can only use the first 300 of 600 shared hourly requests, and is separately capped at 300 hourly. Users retain the other 300, and existing user traffic takes precedence over background warming. Fifteen new terms per run means up to 60/hour, approximately five hours for 300 terms without provider failures or competing traffic; timeouts/traffic can extend that, so completion within a few hours is not guaranteed.

The hook imports the current `FOOD_SEARCH_VERSION`, so publishing a future version automatically makes old progress eligible at the next invocation. Completed lists produce no USDA requests but still receive the 15-minute lightweight checks; these checks can keep database compute active. Overlapping runs return busy, crashed leases expire, errors log safe summaries and return a retry response without failing cron. The per-database job token is kept in a service-only table and read by pg_net at execution; it must never be printed or copied between draft/production. No project secret is added or changed.

Background USDA calls each get 25 seconds. A partial/failed term's pipeline retries once after one-second backoff; the second attempt reserves another five calls against the same background allowance. Budget refusal or an aborted run does not retry. The invocation stops starting new terms after 75 seconds and aborts outbound work at 100 seconds, leaving time for progress/release before the existing 120-second pg_net timeout. User searches retain their four-second deadline and no automatic retry. Partial results may populate individual shared food rows, but never write a complete search-list cache, so the next user search or warmer attempt fetches USDA again.

Validation: call the local hook from this sandbox with the draft's token, then inspect progress/current-version cache entries. Do not enable a draft job pointing at the published app. No test accounts or owned-food data are needed.

## Verified draft run

The secured hook was called once and all completed terms were read back from both progress and the v13 search cache: **8/300 complete, 292 remaining**, 41.534 seconds end to end. Three terms reused existing v13 caches; five were newly completed. Seven provider timeouts remain queued. Missing/invalid credentials and a public-key-only request all returned 401. Temporary test terms were deleted; no accounts or owned foods were created by the hook.

| Term | Seconds | Result |
| --- | ---: | --- |
| eggs | 0.055 | Existing v13 cache |
| egg | 3.457 | Warmed |
| chicken breast | 0.051 | Existing v13 cache |
| rice | 0.049 | Existing v13 cache |
| oats | 1.286 | Warmed |
| banana | 4.053 | Partial, retry queued |
| apple | 4.055 | Partial, retry queued |
| salmon | 1.803 | Warmed |
| tuna | 4.055 | Partial, retry queued |
| beef | 4.055 | Partial, retry queued |
| steak | 2.775 | Warmed |
| turkey | 4.059 | Partial, retry queued |
| pork | 3.406 | Warmed |
| bacon | 4.056 | Partial, retry queued |
| milk | 4.058 | Partial, retry queued |

All 1,210 tests across 126 files passed for the initial implementation, including real-database lease, version-change and atomic budget tests. Production registration remains your post-publication SQL step; publishing this code alone will **not** start autonomous warming.

## Background timeout follow-up

The seven prior timeout terms were prioritized for one draft hook invocation. **All seven completed**, and each current-version progress row and search-list cache was read back successfully:

| Term | Seconds | Result |
| --- | ---: | --- |
| banana | 5.234 | Complete |
| apple | 5.872 | Complete |
| tuna | 15.421 | Complete |
| beef | 5.444 | Complete |
| turkey | 6.623 | Complete |
| bacon | 17.810 | Complete |
| milk | 4.754 | Complete |

The same invocation also completed greek yogurt and cheese: **9 newly complete, 17/300 total, 283 remaining**, 79.899 seconds end to end (79.172 seconds measured inside the hook). No warming budget refusal occurred. No temporary accounts or owned foods were created; test terms were removed. All **1,219 tests across 127 files passed**, including longer background per-call deadlines, one budgeted backoff retry, refusal/abort behavior, and proof that timed-out user results do not create a complete search cache and the next search tries USDA again. Typecheck/build clean. Ranking, UI, v13, migration 0120, and activation SQL are unchanged.