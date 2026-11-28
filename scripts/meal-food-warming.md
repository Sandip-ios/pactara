# Durable food-cache warming

Accepting brings migration 0120's progress tables, leases, private job credential and budget RPCs into the app. Draft cached foods and progress never copy to production. Publishing deploys `/api/public/hooks/warm-foods`, but **does not register the production schedule**. The draft's migration tool refused HTTP cron registration; activate the schedule through the hosted backend's managed scheduling tools after acceptance/publication. `schedule-meal-food-warming.sql` documents the exact requested pg_cron/pg_net registration, for a backend that permits it. It has not been executed.

Once activated, `warm-meal-foods` calls the published hook at UTC minutes 0, 15, 30 and 45 (96 daily). Each run claims a five-minute global lease and up to 15 unwarmed terms with `FOR UPDATE SKIP LOCKED`, oldest unattempted first. Finished current-version caches count as complete without USDA calls. Failed/partial terms stay pending and rotate behind unattempted terms. Each normal search reserves five requests atomically against the shared allowance; warming can only use the first 300 of 600 shared hourly requests, and is separately capped at 300 hourly. Users retain the other 300, and existing user traffic takes precedence over background warming. Fifteen new terms per run means up to 60/hour, approximately five hours for 300 terms without provider failures or competing traffic; timeouts/traffic can extend that, so completion within a few hours is not guaranteed.

The hook imports the current `FOOD_SEARCH_VERSION`, so publishing a future version automatically makes old progress eligible at the next invocation. Completed lists produce no USDA requests but still receive the 15-minute lightweight checks; these checks can keep database compute active. Overlapping runs return busy, crashed leases expire, errors log safe summaries and return a retry response without failing cron. The per-database job token is kept in a service-only table and read by pg_net at execution; it must never be printed or copied between draft/production. No project secret is added or changed.

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

All 1,210 tests across 126 files passed, including real-database lease, version-change and atomic budget tests. Typecheck/build clean. The remaining deployment blocker is production schedule registration on the hosted backend; publishing this code alone will **not** start autonomous warming.