# Phase 5.1a: New check-in page after recording (new version only)

Classic is untouched: every change sits behind `useAppVersion() === "new"`.

## Answers to section 3 (followers)

**Can followers see check-ins today? No.**
- `check_ins` rows are readable only by members of that crew (policy "Members can view check-ins in their groups" using `is_group_member`), narrowed further by two restrictive policies: "Bilateral check-in visibility" (`safety_visible`, blocks) and "Ended crew check-ins preserve own history". `daily_posts` has the same block and ended-crew rules.
- The only thing a follower gets is numbers: `get_visible_follow_profile_stats(target, viewer)` returns check-in **dates**, rest days and badge count (for the profile streak/stats). It runs only if not blocked and the profile is public and not under 18, or the viewer is an accepted follower. No photo, video, note or activity is returned.
- The feed (`getGroupFeed`), Activity and profile posts all read through crew membership. So today a follower who is not a crewmate sees no check-in content anywhere.

**Smallest safe storage:** one column `check_ins.share_with_followers boolean NOT NULL DEFAULT false`. Every existing row becomes false, which matches exactly what they have today (crews only). No backfill. Per check-in on `check_ins` (not `daily_posts`), because a day can hold several check-ins and the daily post points only at the first one.

**Enforcement:** add one permissive SELECT policy on `check_ins`: `share_with_followers AND EXISTS (accepted follow from auth.uid() to user_id)`. The existing restrictive policies still apply on top, so blocked pairs stay hidden. Teen and private rules: private profiles only have accepted followers anyway; for under-18 accounts the server refuses `share_with_followers = true` and the policy also requires the owner not to be under 18, so teens stay crew-only.

**In this step nobody reads it yet.** We only save the choice. No follower feed, profile grid or notification changes until the step that builds the follower surfaces, so no one sees anything new today. The policy above ships in that later step (or now, harmless since no screen queries it; I'll add it now only if you prefer).

## Answers to section 4 (crew already checked in today)

Today there is **no error and no skip**: `recordCheckIn` inserts a **second `check_ins` row** for that crew (there is no unique rule on `check_ins` per day). The `daily_posts` row is upserted and keeps pointing at the first check-in. Result: the crew feed shows both clips that day, the streak does not change (same date), and badges/celebration rerun with the same streak. Only exception: the same Apple Health workout twice in a crew errors ("may already have been used").

So nothing breaks. For this step the page posts to every selected crew, including already-in ones (it simply adds a second clip that day, which is what step 1b formalises). Crews already in today show a small "In today" mark on their chip, and the camera note tells them it won't add to the streak. If you'd rather hold those back until 1b, I'll post only to not-yet-in crews and show "You're already in with these crews today." when none are left; say which.
