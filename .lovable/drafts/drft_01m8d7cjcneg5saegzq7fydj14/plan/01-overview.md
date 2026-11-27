# Phase 5.1d: crew feed check-in cards and sheets (new version only)

## How the new-version crew feed renders today
- Crew > Posts renders `FeedList` with `variant="redesign"`. It calls `buildFeedDays` (`src/lib/feed-days.ts`), which turns each member's day post (`daily_posts` row, one per member per crew per day) into ONE `checkins` entry holding all of that day's check-ins.
- Each entry renders `RedesignPostCard`: one header (time of the FIRST check-in, its workout title or Health name as the tag), all photos/videos in one horizontal swipe strip, the first non-empty note as caption, then Cheer / Reply / "X cheered".
- No attached workout / plan / Health card exists in the new card yet; the meta line only shows the name. Classic uses `WorkoutSummaryRow` (`FeedWorkout.tsx`) with "New PR: {name} {weight} {unit}" and a sheet that shows weights.
- Day dividers ("TODAY ... 1 of 4 in", "Crew streak kept") come from `redesign-feed-view.ts` and stay as they are.

## Answer to section 1: where cheers and replies live
Yes, they are stored per day post, not per check-in. `post_reactions` and `post_comments` both point at `daily_posts.id` (`post_id`) and have no check-in column. Notifications also use the day post's single `check_in_id` (always the first check-in of the day).

**Smallest safe change:** add a nullable `check_in_id` column to both tables (pointing at `check_ins`, cascade on delete). Empty means "the day's first check-in", so every existing cheer and reply stays on that day's first card with no data copying.
- New version: Cheer/Reply on a card write that card's check-in id (empty for the first check-in, so first-card cheers look exactly like old ones). Each card counts only its own rows.
- Classic: unchanged. It ignores the new column and keeps counting everything on the day post.
- The one-cheer-per-person rule moves from (post, person, emoji) to (post, check-in, person, emoji), so you can cheer two check-ins on the same day.
- Read/insert rules stay the same, plus the check-in must belong to that day post. Blocking rules keep working because they check the day post's author.
- Notifications keep linking to the day post. A cheer on a later check-in shows the first check-in's photo in Notifications for now (known limit, noted, not changed here).

## What changes
1. `buildFeedDays` gets a "split" option used only by the redesign variant: one entry per check-in, newest first within the day. Classic calls it as today.
2. `RedesignPostCard` becomes per check-in, per your spec: 40px avatar, 15px/700 name, 12px meta "{time} · {tag}" (older days: "Yesterday · Run"), green "Checked in" pill on every check-in (driven by "is a check-in"), single 300px media, video length pill, 14px caption, attached item card, PR chip, actions row.
3. New attached item card + three sheets (workout, plan day, Apple Health), built on the existing sheet, `NewStatBox` and `saveCrewWorkout`. No weights anywhere in the new version.
4. Classic files untouched: `TimelineCard`, `FeedWorkout.tsx`, classic `FeedList` path.
