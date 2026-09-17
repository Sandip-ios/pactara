# Start Workout — live accountability

## What you asked for, in short

Right now Pactara covers the promise and the proof. This adds the middle: the moment someone is actually doing the thing.

A person who has already said what they're doing today gets a **Start workout** button on that commitment. Tapping it:

- marks them as working out, right now
- pushes an alert to the rest of that group ("Jose just started his workout 💪")
- shows them a live card with **Record proof** and **Finish workout**
- lets groupmates tap 🔥 💪 👏 to cheer, which sends one light alert back

Starting is not finishing. Proof is still required. Finishing without proof asks for proof first, with a way to quietly end the session instead. Only 1 start alert per person per commitment per day, so nobody gets spammed.

## Screens and states

**Today's commitment card (Home)**
```text
TODAY'S COMMITMENT
Upper Body Workout
[ Start workout ]
```

**While active**
```text
🟢 Workout in progress
Upper Body Workout · Started 18 min ago
[ Record proof ]   [ Finish workout ]
```

**Finish with proof** → green "Workout complete / You showed up / 🔥 8 day streak", member goes to Done, normal completion post lands in the feed with the duration.

**Finish without proof** → sheet: "One last thing — add proof that you showed up before finishing." with `Record proof` and a quieter `End workout without completing`. Ending returns the commitment to "Not completed yet" with `Start workout` available again.

Wording stays split: *Finish workout* = I did it. *End workout* = stop the session, no claim. No "Stop".

**Group view** — members can now read as Not committed / Committed / Working out / In progress / Done / Missed. "Working out now" gets a green live dot and a small timer line, sized to sit alongside the existing statuses rather than dominate.

**Cheering** — the notification opens straight onto that person's live status, not generic Home, with the three emoji taps right there. Their cheer sends one "Michelle cheered you on 🔥".

## Settings

Notifications settings gains four independent switches: Workout started (on by default), Workout completed (off by default), Nudges, Group milestones. Existing switches stay as they are.

## Technical notes

- New `workout_sessions` table: `id, user_id, group_id, post_id (commitment), status (active | completed | ended_without_completion), started_at, ended_at, duration_seconds, proof_completed, start_notification_sent, created_at, updated_at`. Unique partial index on `(user_id, post_id)` where `status = 'active'` so double taps and offline retries cannot create a second session; `startWorkout` returns the existing active session instead. RLS: own rows writable, groupmates readable via `is_group_member`.
- `notification_preferences` gains `workout_start_enabled` (default true), `workout_complete_enabled` (default false), `nudges_enabled`, `group_milestones_enabled`, backfilled for existing rows.
- New `src/lib/workouts.functions.ts` — `startWorkout`, `finishWorkout`, `endWorkoutWithoutCompleting`, `cheerWorkout`, `getActiveSession`. All authenticated server fns; sends go through the existing `notifyUsers` / `pushToUsers` path with the new preference columns, so delivery matches today's reminders (closed app included).
- Start push deep-links to `/groups/$groupId?workout=<sessionId>`; active state is always resolved from the server, so reinstall / second device / app restart all show the same session.
- `group-today.functions.ts` gains a `working_out` status plus `workoutStartedAt`, fed by active sessions for the current local date.
- Record proof reuses the existing check-in flow unchanged; on return, the session's `proof_completed` is derived from the commitment's check-in, not stored separately at capture time.
- Analytics events fired through the existing PostHog provider: `workout_start_viewed`, `workout_started`, `workout_start_notification_sent`, `workout_start_notification_opened`, `workout_cheer_sent`, `workout_proof_started`, `workout_proof_completed`, `workout_finish_started`, `workout_completed`, `workout_ended_without_completion`, `workout_restarted` — each with user/group/commitment/session ids, group size, streak, duration, proof and notification flags, so completion-rate-with-vs-without and time-to-proof are answerable.
- Out of scope, as you specified: pause/resume, calories, heart rate, sets/reps, GPS, workout analytics. No new bottom-nav item.
