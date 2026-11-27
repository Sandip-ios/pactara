# Phase 6 capture and verification review

43 board captures remain at `public/qa/p6-<board>.png`, at 390px wide and 2x resolution. Builder/amount editor, duplicate search, explicit search error, missing calories, edited totals without stray Undo, removal Undo, save toast, post-building and attached-meal states were recaptured through the app. The meal check-in now shows the real card rather than crew Today. Empty and under-18 states were verified separately. Only 76i, 76l and 77e contain the depicted toast.

The captures show actual draft data, not the mockups' example counts or member photos. Discover 75q shows the Meals rail, but this draft's temporary shared workout did not become visible in Discover, so its Workouts rail is absent. This board does not yet match the reference's full populated-rail state. 75o shows meal search results but this draft has no matching workout/person results for that query. No claim of pixel-exact matching is made.

Fixed the missing adult legacy “No calories” label. Nutrition-redacted under-18 snapshots remain label- and number-free.

## Checks
- Final full suite after cleanup: 1,107 passed, 119 files, no failures or skipped tests.
- Typecheck: `oj typecheck -b --noEmit` passed.
- Preview build: OK.
- Real meal save and Profile readback passed; post builder preserved photo/caption, attached the saved meal and posted back to Home. A meal check-in was saved and read back as the other signed-in member with foods, amounts, full nutrition and Add to my meals visible.

## Failures encountered during Phase 6, including earlier runs
All four previously failing tests now pass:
1. `meals.database.test.ts` / `private meals tabs are empty until a follow is accepted`
2. `meals.database.test.ts` / `direct client reads cannot obtain meals or food nutrition`
3. `meals.database.test.ts` / `posting snapshots meal numbers and deleting the saved meal keeps the post copy`
4. `home-feed.database.test.ts` / `saves/removes meal copies and refuses own-post attachment saves`

Capture-script failures (not test-suite failures): invalid auth-session flag; duplicate-row strict-selector errors; wrong Posts role/query; first-open introduction intercepting clicks; nonexistent check-in bucket; rejected unscoped media upload; invalid/duplicate workout share-code fixture; absent Discover Workouts heading. Corrected scripts and valid crew-scoped uploads completed the captured flows. One attempted cleanup transaction was denied on the restricted attachment table; privileged draft API cleanup then succeeded. Discover's populated Workouts rail remains unverified as noted above.

## Cleanup
Removed both temporary Phase 6 accounts and their crew, subscriptions (zero remained), meals/copies, foods/recent-food rows, meal attachments, posts, check-ins, saved/shared workout and all three storage objects. Removed synthetic empty-search entries. The two original example members remain classic and unchanged. Real USDA cache entries remain as normal cached food data. No repository example-data script was added or changed. Nothing published.
