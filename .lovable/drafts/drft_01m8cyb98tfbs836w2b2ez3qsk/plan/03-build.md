## What gets built

**1. Camera (new version)**
- Crew picker removed from `NewCheckInCameraControls`; the top pill becomes a plain label "5-second check-in".
- Record button enabled whenever the camera is ready, never blocked by crews.
- When every active crew is already in today, a note above the button: "You're already in today. This check-in won't add to your streak."
- After recording, go to the new page instead of the auto-submit; the clip stays in the existing check-in stream/photo store so Back returns to the camera with it kept.

**2. New check-in page** (new-version component rendered from `check-in.notes.tsx`; the auto-submit effect runs only for classic... classic has none, so it is simply removed from the new path)
- Header, clip preview (104x184, looping, muted, real length pill, progress bar, tap for full screen with sound and close, reduced-motion still frame with play icon), description field (16px, grows, 500 max).
- "Tag it" card with the 7 classic activities, single select, tap again clears, Workout preselected for logged workout or plan day, hidden for Apple Health.
- "WORKOUT ATTACHED" card for logged workout, plan day or Health workout, using the existing summary line.
- "Check in to" card: chips for all active crews (same names/emoji/partner/solo labels as the old picker), multi select with check icon, default = crews not yet in today; already-in crews still selectable. Divider, "Also post to my followers" switch, off by default, with the On/Off helper line.
- Pinned 52px button: "Check in to {crew}" / "Check in to N crews", disabled with "Pick at least one crew." above it, "Posting..." while posting.
- Same safety as today: upload timeout, never post without media, error text, "Try again", "Save as draft", draft restore (draft now also keeps description, tag, crews, followers choice).
- After posting: existing NewCheckInDone, then celebration. Untouched.

**3. Followers choice saved**
- Migration: `check_ins.share_with_followers boolean not null default false`.
- `recordCheckIn` accepts optional `shareWithFollowers` (default false), writes it on each crew copy; ignored (forced false) for under-18 accounts. Classic never sends it.

**Not touched:** classic, one-per-day rule, NewCheckInDone, celebration, feed, billing/paywall/signup copy. No em dashes.

## Tests
- Pure helper (e.g. `src/lib/new-checkin-form.ts`): button label (1 crew name / N crews / none), default crew selection, Workout preselect, tag hidden for Health, camera "already in" note condition.
- Server: `shareWithFollowers` defaults false and is forced false for teens.
- Full suite + typecheck.

## QA after approval
390x844 screenshots into the QA capture folder (since removed): camera idle; page with workout and 2 crews; followers on; no crew selected; upload error. Real UI on this draft's data only, temporary rows deleted afterwards, nothing added to repo data files.
