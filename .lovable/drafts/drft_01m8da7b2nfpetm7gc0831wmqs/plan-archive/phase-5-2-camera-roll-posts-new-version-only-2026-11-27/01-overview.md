# Phase 5.2: Camera-roll posts (new version only)

Classic does not change. Every new screen sits behind `useAppVersion()==="new"`.

## What already exists
- **Create sheet**: `NewBottomTabs.tsx` already has the sheet. "Check in" and "Build a workout" work. "New post", "Build a plan" and "Add a meal" show as greyed "soon" rows.
- **Check-in camera and compose**: `NewCheckInCompose`, the recorder and uploader, and `recordCheckIn`. These are live camera only.
- **Post cards**: `RedesignPostCard` and `RedesignCheckInCard` (the 1d cards with the green "Checked in" pill), plus `RedesignWorkoutSheet` (sets and reps, PR chip). The feed reads `check_ins` and `daily_posts`.
- **Media**: signed URLs through `media-urls.ts`, `stabilizeSignedUrls`, `FeedImage`/`FeedVideo`, and the `.poster.jpg` upload at check-in.
- **Workout sharing**: `WorkoutSharePanel`, plus `workouts.source_user_id` for credits.
- **Privacy**: the `isUnder18` rule and its database trigger, blocks and reports.
- **Missing pieces**: there is no posts table, no photo library picker or camera plugin (no `@capacitor/camera` or any media picker), no multi-item carousel, no trim or crop, and no background "Posting..." queue.

## What I'd add
1. **A separate `posts` store**, so a post can never be read as a check-in. Streak, Day N, badges and crew pushes only read `check_ins`, so they never see posts. It holds:
   - the post: author, caption, attached workout (session id or saved workout id, or a parsed list), comments on/off, status (uploading, live, failed)
   - its items: up to 10, each with path, kind, order, trim start and end, muted, cover time, 4:5 crop box and poster
   - its audience: everyone yes/no, and one row per crew
   - tags, cheers, comments and saves, which follow the same patterns as check-ins
   - access rules: crewmates see crew-audience posts, anyone sees "everyone" posts, under-18 accounts are blocked from "everyone" at the database level, and blocked pairs are excluded
2. **Create sheet**: the order becomes Check in, New post, Build a workout. "Build a plan" and "Add a meal" are hidden (today they are dead "soon" rows).
3. **Screens**, as new routes under `/post/*`: Picker, Edit, Compose, plus a Share workout composer opened from the finished workout's share button in the new version.
4. **Posting queue**: uploads continue in the background, and Home shows the "Posting..." strip with progress, Retry and success.
5. **Own post view** `/post/$id`: carousel, menu (Edit caption, Delete), counts. The crew Posts feed shows a post card with no tag, mixed in by time next to check-ins.
