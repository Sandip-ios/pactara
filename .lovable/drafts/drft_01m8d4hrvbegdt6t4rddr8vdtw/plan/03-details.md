## New version UI (only change in this step)
- Later check-in finishes on a short "Posted to {crew}" confirmation instead of the streak celebration and badge modal. If posted to several crews and it counts in some, the celebration shows only those crews.
- Assumption: this small confirmation is acceptable now. Tell me if you would rather keep the current screen with no badge until step 1d.

## Plan decision to confirm
A later check-in with a plan workout does not move the plan (strict reading of "only the first counts"). Alternative: let a plan workout advance the plan even on a later post. I will build the strict version unless you say otherwise.

## Tests (one per rule)
- Two dates rows same day: streak, Day N, week count, "X of N", crew kept, nightly miss and 9 PM at-risk unchanged.
- Profile total counts distinct days.
- Later check-in: no crew push, no badge award, `counted: false`, celebration data empty.
- Plan: later check-in with next plan day does not advance or tag; same day twice advances once.
- Health reuse error shows the friendly message.
- Delete first of two: day post re-points to the second, streak unchanged; delete only one: day drops.
- `is_counted_check_in` picks the earliest by time, ties by id; switches after delete.

## Technical details
- Migration (additive): SQL function `public.is_counted_check_in(_id uuid) returns boolean`, true when no other row in `check_ins` has the same `user_id`, `group_id`, `checkin_date` with an earlier `(created_at, id)`. `checkin_date` is already the member's local date, same day key streaks use. Plus a supporting index on `(user_id, group_id, checkin_date, created_at)`.
- Migration: AFTER DELETE trigger on `check_ins` that sets `daily_posts.check_in_id` to the earliest remaining row for that day when it was null or pointed at the deleted row. No backfill of existing rows.
- `recordCheckIn`: before inserting per crew, check whether a row already exists for (user, crew, today); compute `counted` per crew. Skip `notifyGroupActivity` and `awardBadgesForUser` when not counted; return `countedByGroup`. Health RPC path gets the same check after insert. `logPlanWorkout` runs only if any crew counted.
- Feed (`getGroupFeed`): each `check_in` node gets `isCounted` computed from the sorted per-day list already built there (earliest = true), matching the SQL function. Not rendered yet.
- `profile.functions.ts`, `member-profile.functions.ts`, `profile-tabs.ts`: `totalCheckIns` uses distinct dates.
- Health error mapping in the check-in client where the thrown message is shown.
- Pure helper `src/lib/counted-check-in.ts` (`countedCheckInId(rows)`) shared by feed and tests.
- No live data changes; classic components untouched.
