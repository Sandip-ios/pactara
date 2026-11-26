# Phase 5.1b: many check-ins a day, only the first one counts

## The rule in one line
A "counted day" is a member's local date in a crew with at least one check-in. Everything that counts days counts dates, never rows. The earliest remaining check-in of that date (by time posted) is "the one that counts". Delete it and the next one takes over.

## Audit: what a 2nd same-day check-in in the same crew does today

| # | Area | What happens today | Change |
|---|------|--------------------|--------|
| 1 | Streak and Day N (crew, Home, profile) | Safe. Streak, Day N and week counts are built from sets of dates, so a 2nd row adds nothing. | None to the math. Add tests that lock it in. |
| 1b | "Total check-ins" number on profile Stats (both versions) | Inflates. It counts raw rows, so 2 posts in a day = 2. | Count distinct days per crew. Same number everyone sees today, because nobody had 2 a day before step 1a. |
| 2 | "X of N in today" (crew pages, Home, Today tab, celebration) | Safe. Counted per member status ("done"), not per row. | Tests only. |
| 3 | Crew streak kept / nightly missed-day job / 9 PM at-risk / 8 PM reminder | Safe. All use date sets or "any check-in exists". | Tests only. |
| 4 | Badges and celebration | Badges cannot be inserted twice (unique per crew + milestone). But a later check-in still returns streak data and can re-open the celebration with today's badge, and the very first badge check reruns. | Server returns `counted: false` per crew for a later check-in; skips the badge award and returns no new badges. New version shows a light "Posted" confirmation instead of the celebration (see 4 below). Classic gets the same data shape, so its modal simply does not show new badges. |
| 5 | Push and Activity | Double fires. Every check-in sends "X checked in" to the crew again. Activity already groups check-ins by crew and day, so a 2nd row folds into the same group. | No crew push for a later check-in. It still appears in the feed and Activity. Cheers and replies notify the owner as today. |
| 6 | Plans | Same plan day twice: safe, the guarded update only moves once. But a later check-in carrying the plan's next day would advance the plan a second time the same day. | Plan advances only when the check-in is the counted one in at least one of the crews it was posted to. Otherwise the post is saved with no plan tag and the plan stays put. |
| 7 | Logged workouts and Apple Health | Attaching a workout to a later check-in is fine; lift stats read set rows, not check-ins, so no double count. Reusing the same Health workout throws a raw error. | Keep behaviour. Map the "already been used" error to: "You already posted this Health workout. Pick another one or check in without it." |
| 8 | daily_posts and the feed | Feed shows one card per member per day, with each check-in as its own item inside. Deleting the first check-in leaves the day post pointing at nothing (pointer cleared), so Notifications loses its thumbnail; streak still counts because another row exists. | On delete, re-point the day post to the next earliest check-in (database trigger). If none remain, leave it as today. |
| 9 | Classic users | Classic shows the same single day card with both check-in items stacked, one shared cheer and comment row. Day N, week count and streak do not double. Only the profile total (1b) and the repeat push (5) double. | Fix 1b and 5 on the server; classic screens unchanged. |
| 10 | Single source of truth | None. | Add `is_counted_check_in` (see technical section) and an `isCounted` field on each check-in item in feed data. No UI change. |

## Deletes
- Only check-in of the day deleted: no check-in rows for that date, so the day drops out of the streak (same as today).
- First of two deleted: the later one stays, the date still counts, and it becomes the counted one. The day post is re-pointed to it.
- Badges already earned stay earned (same as today).
