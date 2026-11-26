# End crew — review

## Result

- Owner-only **End crew** in new-version crew settings, using NewConfirm with the requested copy.
- Successful ending removes cached active crew rows, returns to the new Crews tab, and shows `<crew> ended.`
- Classic has no End button. Its active lists exclude ended crews, as requested; active existing crews retain their behavior.
- Three additive changes are recorded: ending fields/action, media/session access guards, and operational plan/Health RPC guards. No existing group, membership, check-in, daily post, message, reaction, workout, streak, freeze or badge rows are deleted by ending.
- Accepting this draft brings its data-structure changes into the app automatically; the draft’s own test data never moves into the app. Not published.

## Verification

- Signed in as `redesign-qa@pactara.test`, created **QA End Test** only in this draft, opened the real confirmation and ended it through the app. It remains ended.
- **QA Crew** and **QA Crew 2** remain active. QA Crew was not ended.
- QA Tester had **0 own check-ins before and after**. This account’s history was empty; it was not presented as a nonzero-history test.
- Full before/after snapshots of existing check-ins, daily posts, streak freezes, memberships and badges matched exactly.
- Fresh and reloaded Home/crew lists omit QA End Test. Invite preview returns unavailable; joining and chatting are rejected.
- Real signed-in calls reject direct check-ins, daily posts, Health check-ins and reopening. A second signed-in QA member cannot end or join the ended crew. Anonymous callers have no permission to execute end_crew.
- Shared reminder input test excludes ended crews from daily, evening and streak-risk decisions. Auto-miss loads only active crews; database write guards also reject late writes. No real reminders or pushes were sent during testing.
- 568 tests passed across 54 test files; the preview reports build OK.
- Captures at 390×844 with `?v=new`: `29-crew-settings-end.png` and `30-end-confirm.png`, base64 in `public/qa/end-crew.json`. The settings content fits completely within the screenshot.

## Deliberately preserved historical reads

`profile.functions.ts`, personal badge/streak calculations, saved workouts and own-media/history queries do not lose ended memberships or dates. `member-profile.functions.ts` returns a separate `crewActive` flag: the historical selector and numbers remain, but ended selections cannot offer Invite, Message, Nudge, goal editing or a new freeze. Name/photo editing still works.

Admin historical reporting and moderation reads remain available; ending is not deletion. Previously downloaded media or already-issued signed links cannot be recalled; new crew access/signing is blocked, and existing signed links expire normally.

## Every active-crew query/filter location

Membership list queries use an inner join to groups and filter `groups.ended_at IS NULL` before sorting/limiting. Direct group queries filter `ended_at IS NULL`. The locations below include each explicit filter and lifecycle guard in changed application files.

### `src/lib/__tests__/crew-lifecycle.test.ts`
- Line 10: `expect(crewIsActive({ ended_at: null })).toBe(true);`
- Line 17: `expect(rows.filter(crewIsActive).map(row => row.id)).toEqual(["QA Crew"]);`

### `src/lib/chat.functions.ts`
- Line 12: `.select("group_id, last_read_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 66: `.select("id, name, emoji").is("ended_at", null)`
- Line 74: `.select("id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 136: `.select("user_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`

### `src/lib/crew-lifecycle.server.ts`
- Line 5: `const { data, error } = await supabase.from("groups").select("id").eq("id", groupId).is("ended_at", null).maybeSingle();`

### `src/lib/crew-lifecycle.ts`
- Line 2: `export function crewIsActive(crew: { ended_at: string | null }): boolean {`
- Line 3: `return crew.ended_at === null;`

### `src/lib/crew-management.functions.ts`
- Line 12: `const { data: group, error } = await supabase.from("groups").select("id,name,about,owner_id").is("ended_at", null).eq("id", data.groupId).maybeSingle();`
- Line 14: `const { data: rows, error: memberError } = await supabase.from("group_members").select("user_id,joined_at, groups!inner(ended_at)").is("groups.ended_at", null).eq("group_id", group.id).order("joined_at").order("user_id");`
- Line 29: `const { data: group } = await context.supabase.from("groups").select("owner_id").is("ended_at", null).eq("id", data.groupId).maybeSingle();`

### `src/lib/daily-posts.functions.ts`
- Line 111: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 120: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 152: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 614: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 692: `supabase.from("group_members").select("user_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null).eq("group_id", groupId),`
- Line 1436: `supabase.from("group_members").select("user_id, groups!inner(ended_at)").is("groups.ended_at", null).eq("group_id", groupId),`

### `src/lib/group-today.functions.ts`
- Line 97: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 106: `.select("id, name, emoji, goal, owner_id, created_at, duration_days, start_date, frequency, days_per_week").is("ended_at", null)`
- Line 110: `.select("group_id, user_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 335: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 344: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 351: `supabase.from("groups").select("name").is("ended_at", null).eq("id", data.groupId).maybeSingle(),`

### `src/lib/groups.functions.ts`
- Line 38: `.select("id, name, emoji, goal, duration_days, frequency, days_per_week, owner_id, created_at").is("ended_at", null)`
- Line 47: `.select("user_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 111: `.select("id").is("ended_at", null)`
- Line 122: `.select("id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 178: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 213: `.select("id, name, emoji, created_at").is("ended_at", null)`
- Line 221: `.select("id, groups!inner(ended_at)", { count: "exact", head: true }).is("groups.ended_at", null)`
- Line 248: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 278: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 305: `.select("id, name, emoji, goal, owner_id, created_at, duration_days, start_date, frequency, days_per_week").is("ended_at", null)`
- Line 311: `.select("group_id, user_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 608: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 617: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 631: `supabase.from("group_members").select("user_id, groups!inner(ended_at)").is("groups.ended_at", null).eq("group_id", membership.group_id),`
- Line 682: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 736: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 752: `.select("user_id, joined_at, personal_goal, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 845: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 856: `.select("start_date, created_at, duration_days, frequency, days_per_week").is("ended_at", null)`

### `src/lib/home-crew.functions.ts`
- Line 85: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 94: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 106: `.select("id, created_at, duration_days, start_date, frequency, days_per_week").is("ended_at", null)`
- Line 111: `.select("user_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`

### `src/lib/invite.functions.ts`
- Line 15: `.select("id, name, emoji").is("ended_at", null)`
- Line 25: `.select("id, groups!inner(ended_at)", { count: "exact", head: true }).is("groups.ended_at", null)`
- Line 61: `.select("id, groups!inner(ended_at)").is("groups.ended_at", null)`

### `src/lib/lifts.functions.ts`
- Line 220: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 228: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`

### `src/lib/member-goal.functions.ts`
- Line 28: `.select("id, personal_goal, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 32: `supabaseAdmin.from("groups").select("id, name, emoji").is("ended_at", null).eq("id", data.groupId).maybeSingle(),`
- Line 61: `.select("id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 86: `.select("personal_goal, personal_goal_set_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 108: `.select("group_id, joined_at, personal_goal, groups!inner(ended_at)").is("groups.ended_at", null)`

### `src/lib/member-profile.functions.ts`
- Line 260: `crewActive: Boolean(group && group.ended_at === null),`

### `src/lib/notifications.functions.ts`
- Line 427: `.select("id, name").is("ended_at", null)`
- Line 508: `.select("id, name").is("ended_at", null)`
- Line 551: `const { data: groups } = await supabase.from("groups").select("id, name").is("ended_at", null).in("id", groupIds);`
- Line 607: `.select("id, groups!inner(ended_at)").is("groups.ended_at", null)`

### `src/lib/notify.server.ts`
- Line 65: `const { data: crews, error } = await supabaseAdmin.from("groups").select("id").in("id", crewIds).is("ended_at", null);`
- Line 211: `.select("user_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 236: `.select("user_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 282: `.select("user_id, group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 312: `supabaseAdmin.from("daily_posts").select("user_id, group_id, groups!inner(ended_at)").is("groups.ended_at", null).eq("id", postId).maybeSingle(),`

### `src/lib/pact.functions.ts`
- Line 45: `.select("id, name, emoji, goal, duration_days, frequency, days_per_week, owner_id, start_date, pact_promise, kind").is("ended_at", null)`
- Line 53: `.select("user_id, joined_at, pact_signed_at, personal_goal, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 132: `.select("id, pact_signed_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 154: `.select("user_id, pact_signed_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 156: `supabaseAdmin.from("groups").select("name").is("ended_at", null).eq("id", data.groupId).maybeSingle(),`
- Line 198: `.select("group_id, joined_at, pact_signed_at, groups!inner(kind)").is("groups.ended_at", null)`

### `src/lib/partners.functions.ts`
- Line 100: `.select("user_id, groups!inner(ended_at)").is("groups.ended_at", null)`

### `src/lib/rest-days.functions.ts`
- Line 33: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 39: `supabase.from("groups").select("id, frequency, days_per_week").is("ended_at", null).in("id", safeIds),`

### `src/lib/share-crews.server.ts`
- Line 10: `const { data: mine } = await supabase.from("group_members").select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null).eq("user_id", userId);`
- Line 14: `supabase.from("groups").select("id, name, emoji").is("ended_at", null).in("id", groupIds),`
- Line 15: `supabase.from("group_members").select("group_id, user_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null).in("group_id", groupIds).order("joined_at", { ascending: true }),`

### `src/lib/streak-freezes.functions.ts`
- Line 31: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 51: `.select("joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`

### `src/lib/streak-risk-inputs.server.ts`
- Line 62: `admin.from("groups").select("id, name, frequency, days_per_week, ended_at").is("ended_at", null).in("id", groupIds).order("id").range(from, to),`
- Line 65: `const groupById = new Map(groups.filter(crewIsActive).map((g) => [g.id, g]));`

### `src/lib/workouts.functions.ts`
- Line 83: `.select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 92: `.select("group_id, joined_at, groups!inner(ended_at)").is("groups.ended_at", null)`

### `src/routes/api/public/hooks/auto-miss.ts`
- Line 67: `supabaseAdmin.from("groups").select("id, frequency, days_per_week, ended_at").is("ended_at", null).in("id", groupIds),`
- Line 74: `const groupById = new Map((groupsRes.data ?? []).filter(crewIsActive).map((g) => [g.id, g]));`

### `src/routes/api/public/hooks/daily-reminder.ts`
- Line 69: `? await supabaseAdmin.from("groups").select("id, start_date, duration_days").is("ended_at", null).in("id", groupIds)`

### `src/routes/api/public/hooks/evening-reminder.ts`
- Line 110: `.select("id, user_id, group_id, joined_at, pact_signed_at, pact_nudged_at, groups!inner(ended_at)").is("groups.ended_at", null)`
- Line 142: `.select("id, name, owner_id, created_at, solo_nudge_count").is("ended_at", null)`

### `src/routes/api/public/invite/claim.ts`
- Line 51: `const { data: crew, error: crewError } = await supabaseAdmin.from("groups").select("id").eq("id", data.group_id).is("ended_at", null).maybeSingle();`

### `src/routes/api/public/invite/defer.ts`
- Line 38: `const { data: crew, error: crewError } = await supabaseAdmin.from("groups").select("id").eq("id", groupId).is("ended_at", null).maybeSingle();`

### `src/routes/api/public/og/invite/$groupId.ts`
- Line 26: `.select("name, owner_id").is("ended_at", null)`

## Database enforcement and retained history

- `0056_history_preserving_end_crew.sql`: `groups.ended_at` / `ended_by`; current-owner-only `end_crew` with a row lock and idempotent replay; ended-row protection; active-crew triggers on check-ins, daily posts, messages, membership changes, comments, reactions, likes, nudges, freezes and cheers; restrictive ended-content reads; historical author-owned status and plan-tag paths.
- `0057_ended_crew_media_and_session_guards.sql`: restrictive access for ended check-in/comment/chat media, with author-owned history retained; crew-targeted active workout-session writes blocked after ending.
- `0058_ended_crew_operational_rpcs.sql`: active shared-crew helper for `crew_active_plans` / `crew_on_plan`; active-only `crew_workout_status`; Health check-in active-membership validation before retry shortcuts.
- `notify.server.ts` rechecks the target group and all `crewIds` immediately before sending; `evening-push-plan.ts` includes those group IDs for combined reminders.
- The shared `streak-risk-inputs.server.ts` loader handles the streak-risk hook; its own route did not need another date loop or query change.
- Existing full-crew invite preview/admission behavior is otherwise unchanged; the ended check now applies to preview and final join alike. A broader capacity/admission transaction was not added.

## Other changed presentation/support files

- `NewCrewSettings.tsx`: owner-only centered End button, confirm, toast and active-list cache cleanup.
- `crew-lifecycle.ts` / `crew-lifecycle.server.ts`: pure active-state rule and a shared server access guard.
- `crew-management.functions.ts`: authenticated owner-checked RPC action.
- `ProfileView.tsx` / `profile_.edit.tsx`: hide unavailable active crew actions on historical ended selections without changing their history.
- Required unique page metadata was also filled in on nine existing content pages; no layout or account behavior changed in those edits.
- `src/lib/AGENTS.md`: documents active-query/write versus historical-read separation.
- `roadmap.md`: marks the requested End crew task complete.

## All files changed for this request

- `drizzle/migrations/0056_history_preserving_end_crew.sql`
- `drizzle/migrations/0057_ended_crew_media_and_session_guards.sql`
- `drizzle/migrations/0058_ended_crew_operational_rpcs.sql`
- `drizzle/migrations/meta/0056_snapshot.json`
- `drizzle/migrations/meta/0057_snapshot.json`
- `drizzle/migrations/meta/0058_snapshot.json`
- `drizzle/migrations/meta/_journal.json`
- `public/qa/end-crew-review.md`
- `public/qa/end-crew.json`
- `roadmap.md`
- `src/components/profile/ProfileView.tsx`
- `src/components/redesign/AGENTS.md`
- `src/components/redesign/NewCrewSettings.tsx`
- `src/integrations/supabase/types.ts`
- `src/lib/AGENTS.md`
- `src/lib/__tests__/crew-lifecycle.test.ts`
- `src/lib/chat.functions.ts`
- `src/lib/crew-lifecycle.server.ts`
- `src/lib/crew-lifecycle.ts`
- `src/lib/crew-management.functions.ts`
- `src/lib/daily-posts.functions.ts`
- `src/lib/evening-push-plan.ts`
- `src/lib/group-today.functions.ts`
- `src/lib/groups.functions.ts`
- `src/lib/home-crew.functions.ts`
- `src/lib/invite.functions.ts`
- `src/lib/lifts.functions.ts`
- `src/lib/member-goal.functions.ts`
- `src/lib/member-profile.functions.ts`
- `src/lib/notifications.functions.ts`
- `src/lib/notify.server.ts`
- `src/lib/pact.functions.ts`
- `src/lib/partners.functions.ts`
- `src/lib/rest-days.functions.ts`
- `src/lib/share-crews.server.ts`
- `src/lib/streak-freezes.functions.ts`
- `src/lib/streak-risk-inputs.server.ts`
- `src/lib/workouts.functions.ts`
- `src/routes/_authenticated/account-settings.email.tsx`
- `src/routes/_authenticated/account-settings.name.tsx`
- `src/routes/_authenticated/account-settings.notifications.tsx`
- `src/routes/_authenticated/account-settings.password.tsx`
- `src/routes/_authenticated/check-in.index.tsx`
- `src/routes/_authenticated/groups.$groupId.tsx`
- `src/routes/_authenticated/new-pactara.tsx`
- `src/routes/_authenticated/plan.tsx`
- `src/routes/_authenticated/profile_.edit.tsx`
- `src/routes/api/public/hooks/auto-miss.ts`
- `src/routes/api/public/hooks/daily-reminder.ts`
- `src/routes/api/public/hooks/evening-reminder.ts`
- `src/routes/api/public/invite/claim.ts`
- `src/routes/api/public/invite/defer.ts`
- `src/routes/api/public/og/invite/$groupId.ts`
- `src/routes/join.$groupId.tsx`
- `src/routes/paywall-preview.tsx`
