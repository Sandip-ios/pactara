# Roadmap

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
