# Roadmap

## Phase 5.1c: Posted screen
- [x] Replaced the new-version You're in screen and following celebration modal with one Posted screen, preserving classic completion and share paths.
- [x] Recolored the launch wordmark for the Posted video and new-version share exports; classic share drawing remains unchanged.
- [x] Captured six 390×844 states from real draft check-ins; verified reduced motion, sound, manual play, Share, Close and Done. All 882 tests and typecheck pass; every temporary member, crew, post, subscription and media file was removed; unpublished.
- [x] Matched the Posted header to New check-in with pt-new-top and recaptured badge/no-badge at 390×844, preserving the originals. All 882 tests and typecheck pass; unpublished.
- [x] Made Posted media flex between 260px and 430px with a separate pinned-button row and scrollable content only when below the minimum. Captured the badge/description and no-badge states at 390×844 plus 375×667; the badge/description state has a 16px card-to-button gap and no overlap. All 882 tests and typecheck pass; unpublished.
- [x] Reused the Your progress medal through NewProgressMedal in the Posted badge banner at 40px, preserving BADGE_META titles and classic artwork. Captured the badge state at 390×844 and a true 3× banner crop; verified purple 1, white ring and no white backing circle. All 883 tests and typecheck pass; temporary capture data removed; unpublished.

## Toast clearance above pinned actions
- [x] Registered the new-version plan, plan-day, quiz, pact, notification and done-screen primary actions with useToastAbove; shared classic surfaces opt in only for the new version. Existing tab, Resume, classic builder and Share your win offsets remain.
- [x] Saved toast-planday-2.png and toast-plan.png at 390×844; both measured exactly 12px from toast bottom to button top. 836 tests and typecheck pass; temporary QA plan/account removed.

## Discover Pactara workout names
- [x] Applied the no-op-safe row update for 28 approved key-to-name mappings; this draft had no matching Pactara rows. Plan days and members' saved copies were untouched.
- [x] Replaced the plan-title overwrite in refresh_pactara_workouts with the approved mapping; verified all keys against the database, unique names and no A/B/C suffixes. 836 tests and typecheck pass.

## Icons, toasts, plan stat boxes
- [x] Use the v2 web and native iOS icons; there is no web manifest or Android icon set in this repo. Native icons require a new App Store build.
- [x] Route every toast reachable in the new version through newToast/newToastApi while preserving classic toasts and existing Undo support; success messages use the green check.
- [x] Reuse the new workout stat box on the new plan page; all three measured 56px at 390px with the requested type, spacing, fill and colors. Saved icons-1.png, toast-home.png, toast-planday.png and plan-stats.png. Classic plan checked without shared boxes; 832 tests and typecheck pass; temporary QA plan/account/subscription removed; unpublished.

- [x] Activity grouping review: diagonal 28px avatars aligned in a 40px slot, latest-post thumbnails retained, grouped check-in crew moved to time line, same-day join/pact grouping opens the crew; dl3-grouped.png refreshed at 390px; 678 tests and typecheck pass; temporary accounts/activity removed; classic notifications/server reads unchanged; unpublished.

- [x] New-version Activity grouping within Today/This week/Earlier: grouped reactions/comments/cheers/check-ins/follows, per-person multi-post groups, unread union, safe actions and grouped followers navigation; dl3-grouped.png added to public/qa/deeplinks.json; 677 tests and typecheck pass; temporary accounts/crew/activity removed; unpublished.

- [x] New-version Activity rows and matching pushes open their exact check-in, comment, profile, request or crew destination; deleted/blocked targets toast and stay on Activity; Back restores the same scroll position; two 390px QA captures in public/qa/deeplinks.json; 669 tests and typecheck pass; throwaway accounts and crews removed; unpublished.

## Phase 3 step 4
- [x] New-only followers/following pages, permission-gated profile stat taps, 30-row server pagination/search, follow/remove/unfollow actions; own and approved-other lists verified.
- [x] New-only Activity with existing crew/follow notifications, retained nudges/join requests/streak milestones/pact restarts/evening reminders, pending-follow row, shared read keys, matching bell/native badge window, poster-only media previews. Classic notification page unchanged.
- [x] Follow requests with confirm/delete/follow-back, private-account menu access, disappearance when already followed and empty state verified.
- [x] Six 390×844 base64 captures in public/qa/p3-step4.json; 655 tests across 67 files pass, build OK; all 39 QA accounts, crew and related rows removed; existing example data untouched; unpublished.
- [ ] Push-only reminder history cannot be displayed: 5 PM/personal reminders outside the recorded evening slot and ephemeral partner reminders have no saved event records. Push delivery unchanged; no fabricated history.

- [x] Tiny new-version follow-up: shared crew avatar ring defines its own white token, covering Crews/switcher/Find/header even outside profile token scope; progress link left offset removed. Browser checked actual shared component with 12 photo/fallback avatars at 28/30/36/40px and aligned name/bio/link; 19 existing profile/crew tests pass, build OK; no data changes, screenshots or publishing; classic unchanged.

- [x] Account deletion: both block endpoints cascade from auth.users like follows; reports untouched; two database regressions and actual Settings deletion for classic/new verify both blocks disappear, the complete report survives, audit is written and sign-out reaches /login; 638 tests pass, build OK; temporary accounts/reports/audits removed; no screenshots or publishing.

- [x] New-version avatars share the filled full-disc silhouette across profiles/editor, crew rows/stacks/switcher, chat, requests, pact screens and version-gated shared feed/safety avatars; 47/53/57 and Crews saved as base64 in public/qa/p3-avatar.json; signed-in 20–96px avatars, editor, Block and chat checked at 390px; classic profile/chat retain their fallbacks; 636 tests pass, build OK; temporary accounts/crew removed, unpublished.

- [x] Phase 3 step 2: new-only own profile/menu/editor, crew week/plan/follow data, debounced username validation and real save/reload, working interim privacy/blocked/progress destinations; both account states and captures 47–52 verified at 390×844 in public/qa/p3-step2.json; second crew, plan link, photo picker, discard/Keep editing and classic profile/editor checked; 628 tests pass, compilation clean; both test accounts, crews, temporary plan and their rows removed, including plan history and subscriptions; classic unchanged, unpublished.
- [x] Phase 3 step 3 review: week card never shows a "0-day streak" chip (own and someone else's profile; a lone freezes chip goes full width), ••• menu rows share one 16px/2.25 icon (Report flag, Unfollow UserMinus, Remove follower UserX, Block last in red); captures 57 and 59 retaken into public/qa/p3-step3b.json; 636 tests pass, compilation clean; demo accounts, follows, crews and check-ins removed; classic unchanged, unpublished.

- [x] Step 1 review: migration 0074 refuses classic follow targets, exposes can_follow and preserves follows on version switch; its private default is superseded by the owner's public-default decision. Regression coverage keeps existing privacy choices and teen protection intact; no UI or publishing.

- [x] Redesign profiles/follows step 1: migrations 0071–0073, locked follow/privacy RPCs, safe profile/list reads using existing streak rules, new-only notification source sharing read keys and opted-in push dispatch; 616 tests pass, two transient draft accounts followed/requested/accepted/blocked and removed with their data; no UI or publishing. Physical push delivery remains untested; next UI must call the server mutation wrappers for push dispatch.

- [x] Join requests design review: new-only white preview header/chips/member card/inline join states, request strips and edge-to-edge list, plain pending rows, single-line goal field/text Skip; six 390×844 captures in join-requests-2.json; asked/cancelled/full state, pending link, input/counter/Skip verified; QA Open Crew 2 and seven fillers removed; 578 tests pass, build OK; classic/business logic unchanged, unpublished.

- [x] End crew pre-ship review: deletion cascades/service cleanup verified, retained report/request blockers fixed without rewriting history; storage restriction removed; exact authenticated EXPLAIN with 8 members/2,000 examples removes 6 slow SELECT policies, keeps check_ins/daily_posts; classic video/photo-chat/comments/reactions/nudge/freeze checked; examples/accounts/media/functions removed; 578 tests pass, build OK, results/files/limits in public/qa/end-crew-pre-ship-review.md; unpublished.

- [x] Redesign phase 2 step 5: discoverable crews, private owner/requester join requests with 14-day expiry and safe approval; Find/preview/requests/pending switcher/first-goal/settings UI; draft-only QA request/approve/decline and seven captures in public/qa/join-requests.json; classic invites unchanged; push delivery and blocked-owner filtering verified in code only; 568 tests pass, unpublished.

- [x] Redesign top spacing: shared safe minimum for new-only headers and Settings subpages, preserve larger intro/done spacing and camera placement; four captures saved in top-spacing.json at 390×844 with first-row centers y=78; new Settings/subpages 56px vs classic 20px, simulated insets 0/47/59 verified; 564 tests pass, unpublished.

- [x] Redesign phase 2 step 4 visual follow-up: shared centered destructive alerts, round crew menu button, current crew first, about placeholder; captures 23, 25, 27, 28 verified at 390×844 and saved in phase2-step4b.json; Cancel checked, no destructive actions or new data; classic unchanged, unpublished.

- [x] Redesign phase 2 step 4: NewSheet crew switcher/menu, owner settings/about, locked owner-only transfer/removal and departure; existing invite/goal/pact/leave logic reused; captures 23–28; Save/reload/restore and rejected non-owner writes verified with existing QA accounts, no new rows or destructive actions; classic unchanged, unpublished. Notifications/mute/check-in unread controls omitted because they do not exist.
- [x] Redesign End crew: additive ended fields and owner-only action; ended crews excluded from active lists, access/writes, invite/join and scheduled jobs with history preserved; new-only confirmation/toast, QA End Test left ended, captures 29–30 saved, signed-in owner/non-owner guards verified, 568 tests passed; unpublished. Full query/file audit in public/qa/end-crew-review.md.

- [x] Redesign phase 2 step 3: new-version Home, camera/crew picker and done screen on existing check-in flow; QA screenshots 16–19 and combined base64 JSON; real five-second recording/upload/post and focused chat verified, temporary video/post/badge removed, optional QA Crew 2 retained; classic unchanged, 560 tests passed, unpublished

- [x] Profile Phase 3: approved Badges/Stats tabs, crew-scoped charts and insights, privacy; 390px/500px browser-only layout checks, typecheck and 544 tests passed; no database test rows or publishing
- [ ] Profile Phase 3 live data / crew switching / lifts navigation verification: existing-account sign-in unavailable; no test accounts or database rows created

- [x] Profile Phase 2: approved profile/Edit profile layouts, weekly freeze, nudge states, setup progress and Health in Settings; browser-only layout checks and focused/full tests passed (unpublished)
- [ ] Profile Phase 2 live save/freeze verification: needs an available signed-in account; no test accounts or database rows created

- [x] Profile safety: approved report/block menus, bilateral server enforcement, hidden posts, blocked people settings, admin review and focused tests (unpublished)

- [x] Free plan starts: plan-only paywalls removed, server restrictions audited, start/resume/switch/workout flows tested (unpublished)

- [x] Apple Health: iOS-only adapter, first-check-in prompt, Home workouts, posted stats, Profile settings, native instructions and tests (unpublished)
- [ ] Apple Health on device: enable HealthKit and usage description in Xcode, update privacy disclosures, and test permissions/sync in a native iPhone build on José's Mac (instructions ready)

- [x] Plans data: 6 moves without a demo swapped for library moves, goals strength/mobility, equipment type on every plan, Home No Equipment under Get moving again, 12 new plans, new Discover order (unpublished)
- [x] Discover for 18 plans: 8 goal tiles, All plans with filter chips and sheets (days, minutes, equipment, level, goal), cover cards, active plan first, crew days note (unpublished)
- [x] What's new sheet (November update): once on Home for accounts from before the release, saved on the profile, waits if another sheet or the paywall is up; What's new row in Account settings (unpublished)
- [x] Find your plan quiz: 4 questions, best match + 2 alternatives, Discover card and Workouts buttons (hidden with an active plan), browse with my answers (unpublished)

- [x] Plan sharing: Share panel on plan pages (send to a crew once, Share a link), plan card in crew chat (View plan, sender can delete, push + notification), public /p/<plan> page (signed in → plan page; signed out preview with sharer's first name, join/sign in keeps the plan and Home opens it), link previews with the plan cover; /p/ in the app-link file and launch links (unpublished)
- [ ] /p/ links open in the iPhone app — same Associated Domains native build as /w/ (steps in native-assets/ios/README.md)

- [x] Share your win: purple button/kicker, one streak number for badge + cards, no duplicate count; full-screen share screen (Story/Post, live video preview with card, Edit card switches remembered per card type, Instagram/Facebook Stories, Save video, More) rendering the MP4 on the phone (unpublished)
- [x] Share your win everywhere: own feed posts and Home Today card open the same screen with that post's own numbers; photo posts share as images; old picture card removed (unpublished)
- [ ] Instagram/Facebook Stories with movable sticker + direct Save to Photos — needs the PactaraShare plugin in Xcode, a native build and the Meta App ID (steps in native-assets/ios/README.md)

- [x] Workout sharing: save a crewmate's logged workout from the feed sheet; share a saved workout by link (/w/<code>, signed in/out/owner/bad link, auto-save after signup or sign in, link previews); /w/ links count as launch deep links; app-link file lists /w/* (unpublished)
- [ ] Shared-workout links open in the iPhone app — needs the Associated Domains capability in Xcode and a native build (steps in native-assets/ios/README.md)

- [x] One light launch screen (web + native config + iOS storyboard), no fixed timers (ready or 2.5s cap, 200ms fade), PactSplash removed, start-up checks in parallel, launch routes straight to login / notification or link / goal / pact / partner / Home; warm resume untouched (unpublished)
- [ ] Install the new iOS launch screen in Xcode and ship a native build — needs the Mac/Xcode project (files ready in native-assets/ios)

- [x] Workouts tab replaces Chat (dumbbell tab; chat button in Home header with unread badge), Workouts page (plan card + options, this week tiles, My workouts, Recent + sheet + do again, Your lifts), Lifts off Profile, leave/pick up/start over/switch plans, toasts above bottom bar (unpublished)

- [x] Builder follow-ups: "Discard changes?" sheet when leaving with unsaved edits, sets control wraps under the name instead of cutting the equipment label, picker line "reorder on the next screen" (unpublished)
- [x] Build-your-own: picker opens a New workout screen (name, drag order, sets) to save for later or Start now; My workouts rows open Edit workout (save changes, start, delete); only an explicit Start begins a workout; Workout done shows Update for saved workouts, Save as a workout for plan days/unsaved (unpublished)

- [x] Workouts follow-ups: Home "Log a workout" opens Start a workout; plan day bottom bar is only Start workout + caption; Workout done weekday and exercise history dates use the member's saved timezone (unpublished)

- [x] Exercise How to full page (markup): two-pose hero with pause and reduced motion, muscles, description, steps, tips/mistakes, too hard/too easy with swap into a live workout; only real-exercise fit cards tappable, tip cards static, no form-check button (unpublished)

- [x] Plan day as a full page (markup), tile pictures, full-screen how-to, change workout, start in logger; old preview sheet removed (unpublished)

- [x] Build-your-own workouts + weight tracking + exercise library: RepDB library (708, images in our storage), plan moves mapped, custom exercises, Start a workout, picker, set logger with prefill/tips/PRs/rest timer/minimize bar, Workout done, feed summary + sheet, exercise progress, profile Lifts, lb/kg + RepDB credit in settings (unpublished, awaiting review)

- [x] Mixed crews get one 8 PM push naming all (at-risk first); a personal reminder set 8:00–9:59 PM counts as the night's evening push; celebration judges teammates by their own today (unpublished, awaiting review)

- [x] One evening push (8 PM or 9 PM) per person per local day, recorded so repeat runs can't double-send; Groups list and crew page judge teammates by their own today (unpublished, awaiting review)

- [x] Crew page Today tab: members resting today show "Resting today", can't be nudged and aren't counted as due (unpublished, awaiting review)
- [x] Feed: rest/freeze days show without a post (today's own row, past combined row); GIF/photo-only comments read "{Name} sent a GIF/photo" in preview, push and notifications; solo/partner-search empty feed message restored (unpublished, awaiting review)
- [x] Feed follow-up: no day collapsing, older weeks load on scroll, one combined quiet row on past days, status-bar cover behind sticky day headers, "Weekday · Mon D" headers (unpublished, awaiting review)
- [x] Home redesign part 2: feed cards restyle (cards, action row, comments preview, quiet rows, day groups, comments sheet, loading/empty/offline, week-dots label)
- [x] Allow GIF/photo/video comments with no text

- [x] Home part 1 follow-ups: guide pill by account age, crew bar one line ("Rest days are automatic"), Today headline leaves out members resting today, pod → crew copy (unpublished, awaiting review)

- [x] Home redesign part 1: header pill only for new members (+ settings row), crew bar, single Today card, Crew today row with per-member week dots and nudges, skeletons (unpublished, awaiting review)

- [x] Paywall (no reviews, crews, yearly default), nudges once a day + covered check, missed cards show the day, morning reminder per group, 8 PM defers to 9 PM (unpublished, awaiting review)

- [x] Evening reminders per group (skip covered days / rest left), check-in rest screen per group, 9 PM freeze wording, Home pace bar hidden (unpublished, awaiting review)

- [x] Streak follow-ups: 9 PM at-risk push per group only when no rest days left; profile "weeks on goal"; Home This week + Mon–Sun dots; daily groups show target 5 (unpublished, awaiting review)

- [x] Streaks follow each group's weekly rule; rest days automatic (Mon–Sun local weeks); local-date streaks on profile, Groups and Home; feed shows "Rested · streak kept"; this week's missed days corrected

- [x] Remove the daily commitment (screen, Home card, reminders, missed-commitment tiles, onboarding copy); rest day moved to Home; Start workout removed from Home too — Home shows only Check in

- [x] Make the founder Overview summary follow the selected time range — six regression tests pass; private dashboard verified across all five ranges (7 days: 1 signup; today: 0)

- [x] Refresh cached photos on native app resume and prevent blank member tiles — resume regression test and browser photo recovery pass; physical-device verification remains blocked below
- [x] Reduce feed media requests and defer off-screen video downloads; build and existing regression tests pass
- [ ] Verify signed-in feed/video load times on device — blocked by unavailable signed-in preview session

- [x] Show the existing “How Pactara works” sheet instead of the welcome sheet on the first Home landing after signup, including partner signup
- [x] Waiting (search) screen: live radar animation, orbiting candidates, "We're looking for someone who's ready to show up with you." subline — no shimmer bar, no Continue button, no "Partner search active" badge
- [x] Waiting (search) screen headline: "Finding your accountability partner" (no "still"/"person" variants), wraps to two lines
- [x] Matched screen: dramatic reveal (pop-in avatars, glow burst, confetti)
- [x] Dramatic "matching you now" cinematic takeover immediately after tapping "Find me a partner", jumping straight to the matched reveal
- [x] Match reveal: paired portraits and equal goal treatment inspired by Tinder's composition, without dating cues
- [x] Match reveal: "It's a Match!" script headline that can't clip, equal-height goal cards
- [x] Waiting (search) screen: "Keep using Pactara" primary button (goes Home, search keeps running) above "Invite someone instead"
- [x] Use state-aware Pact names across Home, Check In, Groups, Chat, Notifications, and Profile
- [x] Fix the iPhone crash from the ••• menu on your own post: bottom sheet instead of dropdown, tap-to-top parking stands down during sheets/menus
- [x] Groups list and check-in celebration leave resting members out of the count and show them resting (moon), never nudgeable
- [x] Workout plans phase 1: Discover tab (Crews | Plans), six seeded plans, plan detail/day screens, free plan and workout starts, plan-day check-ins that advance the plan, feed plan tag, profile current/past plans
- [x] One entry point per plan action: "YOUR PLAN" badge in Discover list, Workouts card opens today's day (chevron, footer to plan), day-page kicker links to plan, "Today's workout" labels (unpublished)
- [x] Share a workout into crew chat: Share panel in Edit workout (send to crews / share a link), workout cards in chat with View workout, sender can delete, "shared a workout" notifications (unpublished)
- [x] Move crews out of Discover: Discover plans only, Home "Your crews" sheet + ••• crew sheet, Leave crew keeps history, crew wording, real crew rule labels (unpublished)

- [x] Workouts tab (no plan, no quiz answers): the "Not sure? Find your plan" card from Discover, shared component, with a centered "or browse all 18 plans" link under it (unpublished)
- [x] Redesign phase 2 step 1: new-version Crews tab and crew Today/Posts/Chat, QA Two and media-free check-in, screenshots 10–13 with base64 copies; classic unchanged, 554 tests pass (unpublished)

## Phase 2 step 6: End of pact (goals kept, option 1)
- [x] Pact done screen (member helper: "<Owner> runs <crew> and decides what's next.")
- [x] Next pact screen
- [x] New pact banner: bg #F5F0FF, radius 18, pad 14/16, margin 12px 16px 0; title 15/800 #4C1D95; body 14 #5B21B6 4px below; buttons 10px below, 8px gap, h36 r18 13/700 px12; primary #7C3AED/white, Later #EDE4FF/#7C3AED
- [x] Between pacts: same purple card; subline "Private crew · pact done"; owner/member copy per spec; Today card unchanged
- [x] Captures 38–43 into public/qa/pact.json (42 owner gap, 43 member gap)
- [x] Crews tab: note removed, "N new" chat badge (new version; no crew limit)
- [x] Phase 2 step 7: Notifications off banner, Settings screen, Settings row Off (new version)

## Phase 4: Workouts and plans (new version only)
- [x] Step 1: Discover shell (Workouts placeholder + Plans tab, ?tab=workouts|plans, goal chips, YOUR PLAN card with crewmate line, quiz/match card); 390px captures in public/qa/p4-1.json; classic /groups unchanged.
- [ ] Step 2: Plan page with start, menu, end, progress
- [ ] Step 3: Plan day
- [ ] Step 4: Quiz
- [ ] Step 5: Workout page (equipment, reps, tip fields)
- [ ] Step 6: Builder
- [ ] Step 7: Logger
- [ ] Step 8: Exercise page
- [ ] Step 9: Discover Workouts with Pactara + public workouts, saves and did-it counts

## Phase 4 step 6
- [x] Detailed muscle tags on all 707 tagged library exercises (Corpse Pose untagged); chips use them in the new version only.
- [x] Author full name when public or followed; first name otherwise; logged-out share pages unchanged.
- [x] Workout list names wrap; workout menu matches plan menu; Discover top spacing 13/12px.
- [x] New-version builder (new/edit), Build a workout in + Create, captures in public/qa/p4-6.json; test data removed.
- [ ] Exercise picker still has its existing look (not restyled yet).

- [x] Logger rest bar: on warm gray under the white band, 48px, pinned; screenshot p4-7b
- [x] Workout cover library: 24 credited Unsplash photos in Pactara asset storage, three per focus with equipment variants; stable new-only cover keys from detailed primary muscles/equipment, Pactara plan covers and single-exercise drawings preserved; three 390px captures in public/qa/p4-9c.json; temporary QA accounts/workouts removed; unpublished.

## Phase 5 step 1a: New check-in page (new version only)
- [x] Review fixes: switch/header/secondary colors, camera note at top, discard confirmation for button/history back, unobscured scrolling; four public/qa/p5-1a-fix-*.png captures at 390x844 with simulated 47/34px safe areas; temporary member/subscription/crews/check-ins removed, 863 tests passed and typecheck clean. Physical iOS swipe not device-tested.
- [x] Camera records only ("5-second check-in" label, record always enabled, already-in note)
- [x] New check-in page: clip, description, Tag it, workout card, crews, followers switch, pinned button, already-in note, draft keeps crews and followers
- [x] Followers choice saved per check-in (default off, off for under-18); nothing reads it yet
- [x] QA: six 390x844 screenshots in public/qa/p5-1a-*.png
- [ ] Step 1b: extra same-day check-ins rules

## Phase 5.1b: many check-ins a day, first counts
- [x] Server: counted per crew, skip push/badges for later check-ins; plan advances once per local day per plan
- [x] Distinct-day profile totals; friendly Health reuse message
- [x] DB: is_counted_check_in + index; delete trigger re-points day post
- [x] Feed isCounted field (no UI); tests; DB QA

## Phase 5.1d crew feed (new version)
- [x] check_in_id on cheers/replies, per-check-in counts
- [x] One card per check-in, attached cards, 3 sheets, no weights
- [x] Notifications/Activity use the cheered check-in's photo and link (new version only)
- [x] QA: 10 screenshots p5-1d-, tests, typecheck, commit

## Phase 5.1d screenshot review fixes
- [x] Plain trailing menu, library drawing verification, exact comment thumbnails
- [x] Recapture top feed, unsaved/saved sheet, isolated plan/Health cards and Activity; remove temporary draft rows
- [x] Full tests including database tests, typecheck and commit; no publish

## Phase 5.2 camera-roll posts
- [x] Build posts flow (picker, edit, compose, share workout, posting strip, own post, crew feed)
- [x] Audience design superseded by the single-choice Compose update below
- [x] Tests + p5-2 QA screenshots (10 at 390x844); test data removed

## Phase 5.2 Compose design update
- [x] Attachment suggestion, workout cards and selection/edit sheets; meals remain hidden
- [x] Single-choice audiences, durable remembered defaults, privacy/teen rules, own-post audience editing and lock
- [x] Real draft-only posting, audience-edit readback, lock, picker/editor and defaults verified; nine 390x844 screenshots in public/qa; all temporary members, subscriptions, crews, posts, workouts, exercises and media removed; 939 tests pass, typecheck clean; committed without publishing

## Phase 5.2 visual review fixes
- [x] Compose and Share workout stone background, separate cards, icons, inline crew Change, lighter radios and exercise pills; updated length error copy only
- [x] Captured nine composer states plus single/multiple picker, video trim, Home posting strip, own Everyone menu, profile lock, mixed crew feed and Share workout at 390×844; 17 p5-2-fix- captures in public/qa
- [x] All 939 tests passed; preview compilation clean; actual posting/readback and zero page errors verified; both temporary members and every related row/media object removed; committed without publishing
