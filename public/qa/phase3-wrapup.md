# Phase 3 wrap-up report

Draft: "Redesign phase 3: profiles and follows". Report date: 2026-11-26. Nothing in this report was published.

## 1. Classic regression

Throwaway accounts (random passwords, not stored anywhere):
- **Casey Classic** (classic, crew owner) and **Nia Newman** (new version), both in **Classic QA Crew**. Casey had two earlier check-ins, 2 freezes and a missed day; Nia had a check-in today.
- Everything was done at 390×844 as Casey, without `?v=new`. No page errors came up.

| Flow | Result | How it was checked |
|---|---|---|
| Home | PASS | Crew today, Nia's post and the bottom tabs show in the classic look. No follow UI. |
| Crew | PASS | Crew page with its classic Today / Activity tabs (the classic crew feed tab, unchanged). |
| Check-in | PASS (opening only) | "Check in with video" opens the classic camera. Recording can't start in the test browser, same as phase 2. The classic recording and posting code is untouched in this draft. |
| Chat | PASS | "Hello crew" sent and saved. |
| Comments | PASS | "Great work Nia" posted and shown ("Comments · 1"). |
| Reactions | PASS | Cheer shows "You" under Nia's post. |
| Nudge | PASS | "Nudge Nia" saved a nudge from Casey. |
| Freeze | PASS | "Use freeze" on the profile saved a freeze for the missed day (Nov 25). |
| Profile | PASS | Classic profile with Posts / Badges / Stats. No followers, following, @username or See progress. |
| Edit profile | PASS | Name changed and saved. |
| Notifications | PASS | Classic list ("Nia Newman checked in", joined, made the pact); "Mark all read" saved 4 reads. No follow items. |
| Report from classic | PASS | Nia's profile ••• → Report → Harassment + "Also block Nia" → "Report sent. Nia is blocked." Report saved with the crew. |
| Block from classic | PASS | Block saved; Nia shows in classic Blocked people. |
| Account deletion | PASS | Delete account → Yes, delete → login screen. Profile gone, the block gone, the report kept. |

**Classic shows nothing from phase 3:** opening a new-version crewmate's profile from classic shows the classic profile (Message, Posts, Badges, Stats) with no Follow button, follower counts or username. Classic Home, profile, edit profile and notifications have no follow UI, Activity screen, privacy screen or progress redesign. Classic members also can't be followed (a database rule refuses it).

## 2. Classic diff audit (files outside src/components/redesign and new-only routes)

Compared with the commit before phase 3 (`9a648ba6`).

**No classic change:**
- `profile.tsx`, `profile_.edit.tsx`, `u.$userId.tsx`: pick the new screens only in the new version; classic still renders ProfileView / EditProfile. Their loaders only prefetch new data on new visits.
- `account-settings.blocked.tsx`: new version gets the new Blocked people screen; classic keeps its old screen. (Classic also lost the new-version-only padding branch, which never applied to it.)
- `chat.$groupId.tsx`, `chat.index.tsx`, `feed/FeedMedia.tsx`: the silhouette avatar replaces initials only in the new version.
- `safety.functions.ts`: the blocked list also returns block date and username. Classic ignores them.
- `media-urls.ts`: adds a thumbnail helper used only by new Activity.
- `follows.*`, `follow-profile.ts`, `profile-social.*`, `redesign-profile*`, `progress-view.ts`: new-only rules and reads.
- `styles.css`: new styles are scoped to new-version class names.
- `types.ts`, `routeTree.gen.ts`, `AGENTS.md`, `roadmap.md`, tests: no app behavior.
- New-only routes: `activity`, `follow-requests`, `u.$userId_.follows`, `profile_.privacy`, `profile_.progress` (classic progress page unchanged).

**Small, checked, no visible change for classic:**
- `notifications.functions.ts`: the bell count now also asks for new Activity items. For classic accounts those come back empty (tested), so the classic count is the same. It's one extra small request per count. `getNotifications` keeps classic's media path unless the new screen asks for thumbnails.
- `safety-rules.ts`: a report may have no crew only for a profile report; the database allows that only from the new version. Classic reports always carry a crew (seen in the test).

**FLAG, admin only:**
- `admin/reports.functions.ts`, `admin/reports.tsx`: reports without a crew show no crew name and hide "Remove member from crew". Admin page, not seen by members.

**FLAG, classic is affected by new-version actions or shared rules:**
- Account deletion (classic too) now also removes that person's blocks in both directions. Owner-approved; reports stay.
- Under-18 profiles are forced private by a database rule, including classic accounts. Classic has no screen where that shows.

## 3. Database changes 0071–0081

| # | What it does | Safe for live data? | Touches existing rows? |
|---|---|---|---|
| 0071 | Follows and follow notifications tables, follow/unfollow/request actions, profile lookup, teen privacy rule, auto-accept requests when going public | Additive | **Yes: sets existing under-18 profiles to private** (birthday under 18 and not already private). No other rows. |
| 0072 | Read rules for follow notifications, follow pushes, visible follow counts | Additive | No |
| 0073 | Tighter follow notification read rule | Safe | No |
| 0074 | Classic profiles can't be followed; new-profile default private | Safe | No (default only) |
| 0075 | Username availability check | Additive | No |
| 0076 | New-profile default back to public (net default: public) | Safe | No (default only, existing choices kept) |
| 0077 | Reports may have no crew (new-version profile reports) | Safe | No |
| 0078 | Fix for that report rule | Safe | No |
| 0079 | Deleting an account removes its blocks both ways | Safe | No existing rows changed (old orphan rows are left alone) |
| 0080 | Followers/following lists and Activity extras | Additive | No |
| 0081 | Activity hides your own badges and pact restarts | Safe | No |

- **Data loss:** none. Only 0071 changes existing rows, and only the privacy setting of under-18 profiles.
- **Locks:** all short. 0071's update briefly locks only the under-18 profile rows it changes. 0071 also adds a trigger on profiles, 0077 changes a column rule on reports, and 0079 adds two links from blocks to accounts (not checked against old rows, so no long scan). Each takes a brief table lock, about a second on tables this size. Live table sizes were not measured.

## 4. Account deletion

Tested in the new version with a throwaway account that had 2 follows (one each way), 1 follow request, a block it made, a block on it, and a report about it:
- Before: follows accepted, accepted, requested; 3 follow notifications; 2 blocks; 1 report.
- Delete account → Yes, delete → login screen.
- After: profile gone, follows 0, follow requests 0, follow notifications 0, blocks 0. **Only the report remains**, unchanged (reason, reporter, reported person). The deletion record is saved as an in-app deletion.
- Classic deletion was checked in section 1 (block gone, report kept).

## 5. Cleanup list (nothing deleted yet)

**Test accounts (this draft only):**
- `qa-s6-4db159cd57@example.com` (Avery Quinn), with crew **QA Crew S6**, its check-ins, rest/freeze days, badges and logged workouts (Your progress screenshot).
- `qa-wrap-2b39b8f1@example.com` (Nia Newman), the new-version crewmate from section 1. Its crew was removed with the classic owner's deletion; Casey's report about Nia is still saved.
- `demo@example.com` and `viktor@example.com`, with **Dawn Runners** and **Deep Work Circle**: invented example accounts the draft started with.
- All other phase 3 test accounts were deleted after each step.

**Files in `public/qa/`:**
- `p3-step2.json`, `p3-step2b.json`, `p3-step3.json`, `p3-step3b.json`, `p3-avatar.json`, `p3-step4.json`, `p3-step4b.json`, `p3-step5.json`, `p3-step6.json`, `p3-step6b.json`
- `phase3-wrapup.md` (this report)
- Also `/mnt/documents/Pactara-phase3-step4-report.md` (outside the app).

**Repo check:** there is no `db/seed.sql`, and no test passwords are in the code. Test passwords were random and lived only in temporary files outside the project. `.env` holds only the app's public keys.

All test accounts and rows exist only in this draft's data and never reach the app. The `public/qa` files are part of the code: they go live if published, unless deleted first.
