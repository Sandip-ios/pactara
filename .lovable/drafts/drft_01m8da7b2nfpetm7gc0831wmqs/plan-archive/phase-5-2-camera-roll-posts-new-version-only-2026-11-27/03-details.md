## Assumptions (correct me)
- **Native picker**: a new plugin, `@capawesome/capacitor-file-picker` for the library and `@capacitor/camera` for the photo or video camera. It is added to `includePlugins` and to the iOS README with the new plugin count, and the iPhone needs a new App Store build plus the photo-library usage text. Until that build, the web file input is the fallback inside the app. The "Recents" dropdown lists albums only where the plugin supports it. Otherwise it shows Recents only, with no dead control.
- **Trim, mute, cover and crop are non-destructive**: the original file is uploaded once, and playback uses the saved trim window, mute, cover time and crop. Phones don't re-encode the video. The poster is drawn at the cover time.
- **Caption parsing**: a pure, testable parser matches lines like "Squat 4x8" or "bench 4 sets of 8" against `exercises` names. It only stores sets and reps, never weights.
- **Attached workout card**: weights are removed on the server whenever a post is shown, using the same shape as the 1d sheet. The PR chip shows only on your own post.
- **Credits**: "Credits <name>" uses `source_user_id` and sends one notification to that person. It uses neutral "they" when gender is unknown, matching the Phase 1 wording rules.
- **"Shown once" note**: stored per account, not per device.
- **Tag people / Comments On**: Tag opens a crewmate and follower search sheet and stores tags, but tag notifications wait for a later phase. Comments On toggles whether comments are allowed.

## Technical details
- One migration creates the `posts`, `post_items`, `post_crews`, `post_tags`, `post_cheers`, `post_comments` and `post_saves` tables, with grants, RLS, a trigger that refuses everyone=true for under-18 accounts, and a check that at least one audience is on. It also adds a private `posts` storage bucket.
- Pure modules with tests:
  - `post-audience.ts`: crew only, everyone only, both, under-18, and at least one audience on
  - `caption-workout.ts`
  - `post-composer.ts`: the 10-item cap, dirty state for Discard, and the Discover 3-minute skip flag
  - `posting-queue.ts`
- Server functions `posts.functions.ts`: create (status uploading), finalize, delete, edit caption, own posts and crew posts (signed in batches, `stabilizeSignedUrls`).
- A test proves that creating a post leaves `check_ins`, `daily_posts`, streak math and badge counts unchanged, and calls no crew push.
- Feed: `useGroupFeed` merges crew posts into the new version only, and classic's query and path stay untouched. Profile Posts reads own posts first.
- Background upload uses resumable uploads from the app, plus a saved queue that resumes on launch or when the app returns to the foreground.
- New-version pages use `pt-new-top`, `NewSheet` and `NewConfirm` (Discard and Delete). There are no em dashes in the copy.
- QA: example rows in the draft only, deleted afterwards. The 10 `p5-2-*` screenshots are taken at 390x844 and tests are run. Nothing is published.
- AGENTS.md gets a rule that posts are separate from check-ins.
