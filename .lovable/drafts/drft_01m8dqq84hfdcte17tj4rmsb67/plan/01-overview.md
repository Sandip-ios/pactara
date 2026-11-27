# Hotfix: own camera-roll post missing from the Crews feed (new version)

## Diagnosis (live data, read-only)

The data is fine:
- The video `5f368c58-.../1795757361320-0.mov` (2.3 MB) and its `.poster.jpg` are both in the `posts` bucket, uploaded at 05:29:26Z.
- José is a member of the post's crew (4c720c5e, 4 members). The read rules on `social_posts`, `social_post_items` and `social_post_crews` all use `can_see_social_post(..., auth.uid())`. The post is `live` with audience `crews`, so `getCrewSocialPosts` (src/lib/posts.functions.ts:298-307) returns it.
- Signed URLs: if signing fails, `loadPosts` (posts.functions.ts:234-238) sets `url` to null. It never drops the post.
- Cache: PostingStrip refreshes `crew-social-posts` and `my-social-posts` when a post goes live (PostingStrip.tsx:17-18).
- Migrations: live `drizzle.__drizzle_migrations` holds 105 rows. The newest `created_at` (1795752777689) equals 0103's journal `when`, and 0099 to 0102 are recorded too. The functions they add are all on live: `create_library_post_v2`, `get_my_post_audience`, `set_social_post_*` and `can_read_library_comment`. The video limits migration (0098) is applied.

Root cause (rendering):
- `FeedList` draws social posts only inside day sections that `buildFeedDays` creates (src/components/feed/FeedList.tsx:342-406, with posts placed at :369-374 and :405).
- `buildFeedDays` (src/lib/feed-days.ts:56-170) creates a day only from check-ins, updates, rest days, not-yet rows and milestones. It drops any day with no entries (:159).
- José posted at 00:29 New York time on Nov 27. His latest check-ins are from Nov 26, and nobody in that crew has checked in since 05:00Z. So there is no Nov 27 section, and the post is skipped without any error. `hasPosts` is true (:199), so the screen shows "You're all caught up" where the post should be.
- Second cause: the post's day comes from the device's `toLocaleDateString` (:369), but the sections use the profile timezone (`viewerToday`). If the device and profile timezones differ, posts get dropped the same way.
- Home (NewHome.tsx) does not load social posts at all, which is the current design. The profile Posts tab (`getMySocialPosts`) has no day filter, so it should show the post.

## Fix (new version only; classic unchanged because `crewPosts` is `[]` outside the new version)

1. In FeedList, render the union of the `buildFeedDays` days and the days of `crewPosts`. Days that only have posts get an empty section, labeled with the existing `redesignDayLabel`. Sort newest first.
2. Work out each post's day in the same timezone as the sections (the viewer's profile timezone), not with the device's `toLocaleDateString`.
3. Add a pure helper in `src/lib/feed-days.ts` (`withPostDays(days, postDates)`) and a test for it. A post on a day with no check-ins gets its own section, and existing days stay the same.

## Verify
- In the draft, use an example crew with no check-ins today and create a post. Check at 390px that it shows under Today in the crew Posts tab.
- Check that the classic feed is unchanged.
- Run the full tests and the typecheck.
