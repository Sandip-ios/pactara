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

## November 27 reviewed-meal corrections
Implemented the ten requested fixes, new version only: ranked generic USDA results before branded with brand labels, plain-language names and duplicate suppression; real portion sizes; complete portion chips plus g/oz; plural quantities; empty en dashes and scoop customs; copied-meal type/calories and macros followed by a separate source-credit line; no picker options buttons; no added-by-zero labels; corrected count heading; shared orange check-in meal pill and attachment-aware header; updated Create subtitle.

Retook 41 affected captures at 390px/2x. All 43 original board files remain. The two unchanged files are 65k (recaptured to the same image) and 75g (empty profile unaffected). Generic food variants with different nutrition remain separate, while identical name/portion/numbers collapse. USDA source records remain authoritative for nutrients and gram weights. The standard cooked-rice result shows 1 cup, 205 cal, 4 g protein. Old branded-only search cache keys refresh to the new ranked format.

Verified live USDA search, branded results ordered after generics, complete rice chips, copying with full source name, filtered breakfast count, picker attachment by a single tap, under-18 redaction, and a real meal check-in read back as the second member. Its header contains time only and its Add to my meals pill measures 32px with orange background; tapping it saved a copy successfully.

Full suite ran twice: 1,115 tests passed in 119 files, no failures or skips on either run. Typecheck passed. No test failed during this correction request. Capture automation retries: three catalog attempts could not select generic cooked rice from USDA's initial ranking, a teen-profile selector matched both the meal and Added button, and a stale workout picker did not show the newly created workout until fresh navigation. These were corrected; they are not test-suite failures. The captured catalog names and portion variants are real USDA values, not exact mockup example text. Some Discover meal content extends below the viewport because those real food names are longer than the board examples.

Cleanup verified: both temporary members restored then deleted; crew, meals/copies, private foods/recent foods, workout/shares, check-in and attachment snapshots, synthetic no-result searches, and the one uploaded storage photo removed. Zero subscriptions and owned rows remained. Ordinary fetched USDA caches remain. No repository example-data script changed. Nothing published.

## Search names follow-up (Nov 27)
- Rice-only search rewrites, the extra long-grain request, the fixed food ranking and the rice name rule are gone. Every food ranks Foundation, SR Legacy, Survey, then Branded; inside a tier, foods named for the search come first and rows that never mention it are dropped.
- Generic USDA names are cleaned the same way for every food (for example "White rice, medium-grain, cooked", "Chicken breast, cooked, braised"). Foods that would share a name but differ in numbers get a fuller name or a source note; identical ones collapse.
- "1 food" singular on meal rows. Search cache cleared so Recent and meal cards use the cleaned names.
- Retaken: 76c, 76m, 75m, 75n. Full suite 1,126 passed, typecheck clean.

## Ranking and portions follow-up (Nov 27)
- Search sorts by how often members add each food, then foods with a household portion, then tier and name match. Starting portion prefers cup, then piece/slice/medium, then tbsp, then grams; size notes in brackets are dropped from unit names.
- Retaken: 76c, 76d, 76m.

## Capitals and unit labels follow-up (Nov 28)
- Cleaned names keep USDA's capitals for proper nouns (Chinese, Atlantic, Greek, Swiss); only all-caps words are lowercased.
- Unit labels drop the descriptor after the comma unless two portions share the base unit.
- Foods that share a name but differ in numbers now get the source note before falling back to a fuller name.
- All 43 p6 captures retaken.

## November 28 composer spacing only
- Attached meal now matches attached workout: white section has 16px left/right and 10px top/bottom inset, 20px outside radius; inner card has 14px radius and matching 12px top/bottom, 14px left, 8px right padding. The extra 10px top margin is removed only on the composer card. Empty meal section and all other screens unchanged.
- Signed-in browser measurements matched exactly with and without an attached workout. Retook only p6-65u.png and p6-77e.png at 390×1080/2×; 77e was saved through the meal builder with its existing single-cup example and save toast. Both screenshots visually reviewed; zero browser page errors.
- Full suite: 1149 passed across 120 files, no failures or skips. Typecheck passed; preview build OK. Capture setup initially rejected a hyphenated temporary username; corrected before capture, not a test failure.
- Temporary adult account, meals, workout and recent rows deleted; only the single rice add created by this capture was subtracted, no unrelated food counts cleared. Temporary example-data script removed. public/qa retained; nothing published.
