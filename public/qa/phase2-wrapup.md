# Phase 2 wrap-up report

Draft: "Redesign phase 1: foundations". Report date: 2026-11-26. Nothing in this report was published.

## 1. Classic regression

Throwaway classic accounts (password `Throwaway-Classic-1`, new version off):
- `classic-a@example.com` (owner), `classic-b@example.com`, `classic-c@example.com`, all in **Classic Test Crew**.
- Example check-ins, three posts and two chat messages were added for them.
- `classic-d@example.com` was created only to test invite join, leaving a crew and account deletion. It is now deleted.

Screenshots are in `public/qa/phase2-classic.json`, 390 wide, without `?v=new`:
- c01 home
- c02 crew today
- c03 your crews sheet
- c04 check-in camera
- c05 check-in notes/done (posting screen)
- c06 crew feed (Activity)
- c07 a post's comments
- c08 chat
- c09 profile
- c10 account settings
- c11 notification settings
- c12 invite join page, signed out

All render in the classic look, with no new-version styling, and no page errors came up.

| Flow | Result | How it was checked |
|---|---|---|
| Check-in with video | **Not tested (test browser can't record)** | The fake camera shows live video, but pressing record never starts in the test browser. The classic recording code is unchanged in this draft: only the screen title and new-version branches were added. **Try it on a phone before publishing.** |
| Post | **Not tested** | A post comes from a video check-in, so it depends on the row above. The example posts show correctly in the feed. |
| Comment | PASS | Comment saved and shown. |
| React (cheer) | PASS | Cheer saved. |
| Chat with photo | PASS | Message with photo saved and shown in the thread. |
| Nudge | PASS | Nudge saved. |
| Freeze | PASS | "Use freeze" shown for the missed day; "Freeze used" message; freeze saved for that day. |
| Invite link join | PASS (one note) | Join, goal, then the pact screen. Membership saved. Note: at 390×844 the Join button sat under the "How it works" card in the test browser, so it had to be tapped directly. Please check that the Join button is tappable on a phone. Only an unrelated line of that page changed in this draft. |
| Leave crew | PASS | Leave crew, confirm, back to Home; membership removed. |
| Account deletion | PASS | Delete account, "Yes, delete", login screen; account gone. |

Fixed during this check: my last step (notifications) made the classic app log a harmless "No queryFn" console error on every screen. It is fixed, with no visible change.

## 2. Classic diff audit (files outside the new-version screens)

Compared against the commit before phase 1. Each line says what changed and why classic behaves the same, or **FLAG** when classic is affected.

**No classic change:**
- `NativeBootstrap.tsx`: classic still gets the "Turn on notifications" pop-up; it is hidden only in the new version.
- `TimelineCard.tsx`, `feed/FeedList.tsx`, `feed/FeedMedia.tsx`, `groups/AccountabilityBits.tsx`: new-version looks are opt-in; classic uses the defaults.
- `account/SettingsKit.tsx`, `account-settings.blocked.tsx`: new spacing only in the new version.
- `app-version.ts`, `use-app-version.ts`: decide classic vs new. Classic unless switched on (see section 5). Classic now makes one extra small request to read this setting.
- `home.tsx`, `route.tsx`: pick classic or new screens. Classic screens and tabs are unchanged.
- New-version-only pages (`crews.*`, `notifications-off`, `pact-done`, `next-pact`, `preview`, `settings`) send classic members back to their usual classic page.
- New pure-rule files and tests (`crew-badge`, `crew-join.ts`, `crew-management.ts`, `pact-cycle.ts`, `notif-banner.ts`, `redesign-*`, `use-push-permission.ts`): only used by new screens.
- `styles.css`: new styles are scoped to the new version.
- `types.ts`, `AGENTS.md` and tests: no app behavior.

**FLAG: changes classic (all from "End crew", phase 2):** many shared reads now leave out ended crews. Classic members of a crew that the owner ended (only possible from the new version) stop seeing it in lists, chat, notifications, reminders, invites, freezes, workouts and profile goal editing, and posting or commenting there is refused. This is intentional, but classic users will see it:
- `chat.functions.ts`, `comment-reads.functions.ts`, `daily-posts.functions.ts`, `group-today.functions.ts`, `groups.functions.ts`, `home-crew.functions.ts`, `invite.functions.ts`, `lifts.functions.ts`, `member-goal.functions.ts`, `member-profile.functions.ts`, `notifications.functions.ts`, `notify.server.ts`, `pact.functions.ts`, `partners.functions.ts`, `rest-days.functions.ts`, `safety.server.ts`, `share-crews.server.ts`, `streak-freezes.functions.ts`, `streak-risk-inputs.server.ts`, `workouts.functions.ts`, `crew-lifecycle.*`
- `ProfileView.tsx`, `profile_.edit.tsx`
- Background jobs: `auto-miss`, `daily-reminder`, `evening-reminder`, `invite/claim`, `invite/defer`, `og/invite`, `join.$groupId.tsx`
- For crews that were never ended, results are the same.

**FLAG: classic members are affected by new-version actions in shared crews:**
- Join requests and approvals (`crew-join.*`, `crew-join-push.server.ts`) can notify classic owners and members.
- Starting a next pact (`pact-cycle.functions.ts`) restarts the day count and notifies classic members.
- Crew settings, member removal and owner changes (`crew-management.functions.ts`) apply to classic members too.

**FLAG, needs your decision: `new-pactara.tsx` now marks every newly created crew as discoverable, including crews created in classic.**
- New-version members can find those crews in Find a crew and ask to join.
- Classic owners have no way to see or approve requests in classic.
- I recommend making classic-created crews not discoverable. Not changed, because you asked for no new work.

**FLAG, small:**
- `crews.$groupId_.requests.tsx` loads the request list before sending classic members away. They can't reach that page from classic.
- `account-settings.index.tsx`: members who have the new version switched on and chose classic see a "Go back to the new Pactara" banner. That's intended.
- Page titles were added on classic pages: email, name, notifications, password, chat, check-in, crew activity, membership, paywall preview. They show only as the browser tab or share title.
- `evening-push-plan.ts`: evening pushes now also check that the crew is still active.

## 3. Database changes 0054–0068

| # | What it adds | Safe for live data? | Touches existing rows? |
|---|---|---|---|
| 0054 | New-version profile fields (version choice, rollout switch, username, bio and so on). Crewmates can no longer read the new private fields. | Additive. Crewmates' reading permissions changed: no app screen in classic or the new version reads the hidden fields. | Defaults filled in; adds a unique-username check and index. |
| 0055 | Crew description; owner tools (change owner, remove member, leave). | Additive | No |
| 0056 | Ended-crew state, end-crew action, guards that refuse writes to ended crews, restricted reads. | Additive; only affects ended crews (none exist live) | No |
| 0057 | Ended-crew media and workout-session guards | Additive | No |
| 0058 | Crew plan and workout lookups skip ended crews; Health posts to ended crews refused | Safe; same names | No |
| 0059 | Crew discovery and join requests (new table) | Additive | No |
| 0060 | Lets deleting a crew or account work when the crew has ended; removes the media guard | Safe | No |
| 0061 | Temporary speed-test tool (review account only) | Additive; removed in 0067 | No |
| 0062–0064 | Speed comparisons: ended-crew read rules removed and re-added | Net result set by 0065 | No |
| 0065 | Keeps the fast ended-crew read rules (check-ins and posts) | Safe | No |
| 0066 | Reports and join requests keep their crew reference after a crew is deleted | Safe; no loss | No |
| 0067 | Removes the temporary speed-test tools | Safe | No |
| 0068 | Previous pact dates, per-member "seen" markers, owner-only start-next-pact action | Additive | No |

- **Data loss:** none. No migration deletes or rewrites existing rows.
- **Locks:** the risk is mostly 0054, which changes the profiles table and builds a unique username index while blocking writes. On a small profiles table that takes about a second. Others are short changes to rules and guards. Live table sizes were not measured.
- **Rolling back app code after publishing:** republish the previous version from the publish history, or restore its code and publish.
- **Leaving the migrations in place after a rollback:** safe. The old code uses only profile fields it can still read, and no action it calls was removed or renamed. The one difference is for crews ended from the new version: old code would still list them, but posting there would be refused. Old "delete crew" still deletes for real.

## 4. Device testing

- The iOS app loads its web code from the server, the published site `https://pactara.lovable.app`, not from a bundled build. So the phone app always shows what is published, and a draft can't be opened in the phone app without publishing.
- **Without publishing (web only):** create a shared preview link (Share, Create shared preview link) and open it in Safari on the phone with `?v=new`. Layout, flows and data work there. Native parts do not: notifications permission, the native camera, Apple Health and in-app purchases.
- **Safest way to test in the phone app:**
  1. Accept the draft and publish. Everyone stays classic, because the new version is switched off for every account.
  2. Switch the new version on for the owner's account only, then pick New in the app.
  3. Test on the phone. To switch back, use "Switch to classic" in Settings.

## 5. Who sees the new version after publishing

- The live app doesn't have the rollout switch yet. Accepting the draft adds it switched **off** for every existing and new account.
- Nothing in this draft switches it on for anyone automatically. Members can't switch it on themselves either: a database rule blocks it.
- The new version shows only when both are true:
  1. The rollout switch is on for that account. Only an admin can set it, with a database update.
  2. The member chose New. Members with the switch on choose it in the app ("Go back to the new Pactara" in classic Settings) and can switch back from new Settings.
- `?v=new` and `?notif=` work only on preview links, never on the published app.

## 6. Cleanup list (nothing deleted yet)

**Test accounts (this draft only):**
- `redesign-qa@pactara.test` (QA Tester)
- `redesign-qa2@pactara.test` (QA Two)
- `redesign-qa3@pactara.test` (Kemi Ade)
- `classic-a@example.com`, `classic-b@example.com`, `classic-c@example.com`
- `demo@example.com` (Nadia Okafor) and `viktor@example.com` (Viktor Lindahl): invented example accounts the draft started with.

**Test crews:**
- QA Crew, QA Crew 2, QA End Test (ended), QA Open Crew, Classic Test Crew
- Dawn Runners and Deep Work Circle: invented example crews the draft started with.

**Test rows:**
- Check-ins, posts, comments, cheers, chat messages (with one uploaded chat photo), nudges, one used streak freeze and goals for the accounts above.
- Join requests and "pact seen" markers for the QA accounts.

**Files in `public/qa/`:**
- Images: `01-whats-new.png` to `19-checkin-pick.png` (with their `.b64.txt` copies)
- JSON: `end-crew-performance.json`, `end-crew.json`, `join-requests.json`, `join-requests-2.json`, `join-requests-3.json`, `notif.json`, `pact.json`, `pact-2.json`, `phase2-step1.json` to `phase2-step4b.json`, `sheets.json`, `sheets2.json`, `switcher-4.json`, `top-spacing.json`, `phase2-classic.json`
- Reports: `end-crew-pre-ship-review.md`, `end-crew-review.md`, `join-requests-2-review.md`, `phase2-wrapup.md`

All the accounts, crews and rows exist only in this draft's data and never reach the app. The `public/qa` files are part of the code: they go live if published, unless they're deleted first.
