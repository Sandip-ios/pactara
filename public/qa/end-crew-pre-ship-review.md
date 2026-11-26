# End crew pre-ship review

## Rule
Ending a crew must stop new crew activity without breaking account deletion, active classic crews, or personal history.

## Results
- Throwaway ended-crew **member** and **owner** both deleted their accounts through **Account settings → Delete account → Yes, delete**, returned to login, and recorded `source=in_app`.
- A further owner test with a dismissed report and an approved join request exposed two additional non-cascading references. Fixed them with insert/update reference validation that retains historical IDs unchanged. Retest succeeded; the report stayed **dismissed** and request **approved**, with the same crew ID, until explicit test-data cleanup.
- `guard_active_crew_write` returns immediately on DELETE; no trigger using it handles DELETE. `active_crew_members` is INSERT/UPDATE only. `protect_ended_crew` returns OLD on DELETE and allows service_role INSERT/UPDATE cleanup. Ordinary owner reopening remains unavailable; service-role update and deletion both verified. A new reference to a nonexistent crew is still rejected (23503).
- Removed the extra restrictive storage SELECT policy. 0056/0057 remain immutable migration history; 0060 drops the resulting policy, so the earlier ALTER has no effect in the final state. Ordinary storage policies are unchanged.
- Classic with an active throwaway crew: recorded live five-second video, uploaded video and poster, posted its note, and saw it on the profile; uploaded a photo through classic chat and read the message back; comment, post reaction, comment like and nudge writes succeeded and the comment read back through Home. **Use freeze** clicked in classic profile, showed success, saved yesterday's freeze, and reduced available freezes to 1.
- Recorder start used keyboard activation because Playwright mouse activation interacted with the existing carousel pointer capture; touch recording on a physical iPhone was not tested. No recorder UI code was changed. Comments/reactions/nudge used the same authenticated functions as classic controls, followed by UI/readback checks; not every one was clicked in the UI.
- Ended-crew post-comment/media read rejected, workout-session link returned null, cheer rejected, and unread comments returned zero. Own profile history remained **2 check-ins, best streak 3** before and after ending.
- **578 tests passed**; preview **build OK**. Not published. No new screenshots delivered.

## Performance
Authenticated `SECURITY INVOKER` EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON), using the actual projected columns, ordering, limits and ID lists from classic Home/crew feed, chat and profile. 8 members, exactly 2,000 invented check-ins over 250 days, 2,000 daily posts, and 400 examples per interaction table. Each case used 2 warm-ups + 30 samples; numbers are median **database execution time**, not network/page-load time. Full initial plans were retained in the JSON alongside samples. The preliminary parent-subquery benchmark was replaced with exact app-supplied ID lists and is not used below.

| Query | Without End policies (ms) | With End policies (ms) | Overhead |
|---|---:|---:|---:|
| home_posts | 2.729 | 2.933 | 7.5% |
| crew_check_ins | 2.777 | 2.888 | 4.0% |
| profile_history | 97.601 | 104.462 | 7.0% |
| chat | 18.085 | 26.581 | 47.0% |
| comments | 5.753 | 12.049 | 109.4% |
| post_reactions | 5.755 | 12.204 | 112.1% |
| message_reactions | 28.735 | 33.142 | 15.3% |
| comment_likes | 8.723 | 33.502 | 284.1% |
| workout_cheers | 0.163 | 0.206 | 26.4% |

- Removed restrictive End SELECT policies on **group_messages, post_comments, post_reactions, comment_likes, workout_cheers** because they exceeded 20%.
- **message_reactions** initially measured +15.3%, but after retaining it while removing slow parent policies, measured **36.229 ms vs 28.735 ms (+26.1%)**; removed it too.
- Retained only **check_ins** and **daily_posts**: exact feed +4.0%, profile +7.0%, posts +7.5%. All eight unrelated bilateral/block policies and original membership policies remain unchanged.
- All temporary benchmark functions are removed in 0067; no test-only callable endpoint survives. Intermediate benchmark creation/removal migrations are recorded so acceptance applies a complete, ordered final state.

## Audit of every related surface
Read current code unless marked run below. Administrative historical reporting intentionally remains available; no old settled records were modified.

| Surface/flow | Current code read | Result |
|---|---|---|
| Classic/new Delete account | profile.functions.ts; account-settings.index.tsx; NewSettings.tsx; profile deletion trigger; every FK to auth.users/profiles/groups | Same deleteMyAccount; member/owner UI run, extra retained references fixed and retested |
| Home top/cards, crew lists, picker, switcher | home-crew.functions.ts; groups.functions.ts; group-today.functions.ts; rest-days.functions.ts | Active membership joins/direct crew filters present |
| Recorder upload destination | check-in.notes.tsx | Fixed two unfiltered membership lookups before upload; classic video flow run |
| Home/crew activity feed | daily-posts.functions.ts getGroupFeed | requireActiveCrew before query/signing; classic comment readback run |
| Comments, replies, likes, direct post link, unread markers | daily-posts.functions.ts; safety.server.ts; comment-reads.functions.ts | Added active parent checks before reads/signing/interaction and active nested join before unread limit; ended read and unread check run |
| Chat, photo chat, unread counts, message reactions | chat.functions.ts; chat.$groupId.tsx | Thread/roster/unread already filtered; added active message-parent check for reaction toggle; classic photo-chat UI run |
| Live workout link/cheers/start | workouts.functions.ts; lifts.functions.ts | Starts already use active memberships; added direct session/cheer active checks; ended link/cheer run |
| Invite/join, pact and personal goal | invite.functions.ts; groups.functions.ts; invite-resolver.ts; pact.functions.ts; member-goal.functions.ts | Active crew checks present; classic invite logic unchanged |
| Discovery/request/approve/goal | crew-join.server.ts; crew-join.functions.ts; 0059 functions | Discovery and decision check active crew; retained request reference validated on new/reassigned ID |
| Sharing destinations | share-crews.server.ts; workout-share.functions.ts; plan-share.functions.ts | Active roster/destination joins; write guard still rejects ended chat inserts |
| Nudge/freeze | group-today.functions.ts; streak-freezes.functions.ts | Active memberships before decisions; classic nudge and freeze run |
| Notifications and push dispatch | notifications.functions.ts; notify.server.ts | Active groups before notification composition/signing and recheck destinations before sending |
| Auto-miss | hooks/auto-miss.ts; auto-miss-plan.ts | Active group fetch plus defensive filter; write guards reject late ended writes |
| Daily/evening/streak-risk reminders | hooks/daily-reminder.ts; hooks/evening-reminder.ts; streak-risk-inputs.server.ts; streak-risk-plan.ts | Active group/input filter; shared regression test excludes ended crews; real scheduled sends not invoked |
| Health/plan operational functions | 0056/0058 RPCs | Active crew checks retained; own historical paths intentionally remain |
| Profile/badges/status and moderation | profile.functions.ts; member-profile.functions.ts; admin/reports.functions.ts; status RPCs | Own dates/media/history preserved; admin historical access intentional |
| Crew write triggers | 0056/0057 and 0060 | INSERT/UPDATE active guard on posts/chat/members/comments/reactions/likes/nudges/freezes/cheers/session start/reopen; no DELETE guarded |

## Cleanup
All ten throwaway accounts, review crews, 2,000 perf check-ins and associated rows removed. Uploaded video, poster and chat photo removed through Storage API. Temporary db/seed.sql removed so examples are not replayed into future drafts. Existing QA Crew and QA End Test were not touched. Draft acceptance applies structure changes automatically; this draft's data never moves into the app.

## Files changed
- `drizzle/migrations/0060_ended_crew_delete_cascade_and_storage_safety.sql`
- `0061_temporary_end_crew_policy_benchmark.sql`, `0062_end_crew_policy_performance_comparison.sql`, `0063_end_crew_exact_query_benchmarks.sql`, `0064_end_crew_exact_policy_comparison.sql`, `0065_retain_fast_end_crew_read_policies.sql`, `0066_account_deletion_preserves_crew_reference_history.sql`, `0067_finish_end_crew_performance_review.sql`
- Generated journal and snapshots 0060–0067; `src/integrations/supabase/types.ts`
- `src/lib/crew-lifecycle.server.ts`, `daily-posts.functions.ts`, `comment-reads.functions.ts`, `workouts.functions.ts`, `safety.server.ts`, `chat.functions.ts`
- `src/routes/_authenticated/check-in.notes.tsx`
- `src/lib/__tests__/crew-lifecycle.test.ts`, `safety.test.ts`, `crew-lifecycle.database.test.ts`
- `src/lib/AGENTS.md`, `roadmap.md`
- `public/qa/end-crew-pre-ship-review.md`, `public/qa/end-crew-performance.json`

No changes to 0056–0058 files, classic styling, prices, existing settings, or existing settled history.
