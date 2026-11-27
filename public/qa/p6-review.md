# Phase 6 capture and verification review

43 board captures remain at `public/qa/p6-<board>.png`, at 390px wide and 2x resolution. Builder/amount editor, duplicate search, explicit search error, missing calories, edited totals without stray Undo, removal Undo, save toast, post-building and attached-meal states were recaptured through the app. The meal check-in now shows the real card rather than crew Today. Empty and under-18 states were verified separately. Only 76i, 76l and 77e contain the depicted toast.

The four flagged captures were retaken on November 27 at 390px and 2x resolution, through the signed-in app with temporary draft-only data:
- 75o: the query `home` shows People, Workouts, Plans and Meals results together.
- 75q: the populated Workouts rail appears above the populated Meals rail. The page is scrolled slightly so both complete rows fit in the capture.
- 76m: Add food has an empty search field, followed by Recent and Your foods, both visible.
- 76p: the query `rice` shows the USDA White rice, cooked row first, with Already in this meal visible. This is the actual USDA cached food ID used in the builder, not a private food with a matching name. Its temporary plain-language label and controlled rice search were restored after capture.

These capture states are visually verified. Names/counts reflect temporary draft data; artwork falls back to the app's existing placeholders where this draft's catalog has no photo. No app code was changed for this recapture, and no claim of pixel-exact matching is made.

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

Capture-script failures (not test-suite failures): invalid auth-session flag; duplicate-row strict-selector errors; wrong Posts role/query; first-open introduction intercepting clicks; nonexistent check-in bucket; rejected unscoped media upload; invalid/duplicate workout share-code fixture; absent Discover Workouts heading. Corrected scripts and valid crew-scoped uploads completed the captured flows. One attempted cleanup transaction was denied on the restricted attachment table; privileged draft API cleanup then succeeded. During this four-capture retake, the first screenshots still had the introductory overlay; visual review caught this and the final captures were taken after dismissing it. No tests failed in the retake's full-suite run: 1,107 passed across 119 files, with no skips. Typecheck passed and build was OK.

## Cleanup
Removed both temporary Phase 6 accounts and their crew, subscriptions (zero remained), meals/copies, foods/recent-food rows, meal attachments, posts, check-ins, saved/shared workout and all three storage objects. Removed synthetic empty-search entries. The two original example members remain classic and unchanged. Real USDA cache entries remain as normal cached food data. No repository example-data script was added or changed. Nothing published.

For the four-capture retake, both newly created temporary members, their workouts/Discover snapshots, meals, private foods and recent-food rows were removed. Verified zero remaining profiles, subscriptions, workouts, shares, meals or owned food rows for those two IDs. No crew, post, check-in or storage object was created in this retake. The original USDA food name and `rice` search cache were restored and compared to their saved originals. All `public/qa` captures remain for owner review.
