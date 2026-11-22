<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Feed media URLs are signed in deduplicated batches per storage bucket, and feed videos load only near the viewport to avoid competing downloads.
- Sign storage images through `src/lib/media-urls.ts` (resized via image transforms); videos get a `<path>.poster.jpg` preview frame uploaded at check-in. Why: raw uploads are 2–25 MB and made the feed slow.
- Wrap feed/profile query results in `stabilizeSignedUrls` so refetches reuse the same signed URL. Why: a fresh token makes the browser re-download the same media.
- Bridge native app state to React Query's focus manager; member-photo failures show initials until a fresh URL arrives. Why: suspended WebViews can retain expired photo links without emitting browser focus events.
- Build the founder Overview period summary through `period-summary.ts`, using the same UTC date bounds as the selected range and unique user-day commitments. Why: a fixed yesterday summary contradicted the date selector and cross-group copies inflate activity.
- The daily commitment is retired: keep `daily_posts.morning_ritual_*`/`morning_missed` columns only so old posts render; never write them, and keep `/api/public/hooks/morning-ritual-reminder` a no-op. Why: the hourly cron still calls that URL and historic feed cards still read the columns.
- Feed notification links use `/home?group=<id>&post=<id>` built via `src/lib/feed-deeplink.ts`; Home switches to that group and then clears the query. Why: the feed shows one group at a time, so a link without the group left people in the wrong group.
- Streak, week and rest-day math lives in `src/lib/streak-rules.ts` (pure, local dates), the nightly decision in `src/lib/auto-miss-plan.ts` and the 9 PM at-risk decision in `src/lib/streak-risk-plan.ts`; screens and jobs must use them instead of their own date loops. Why: copies drifted into UTC dates and daily-only logic.
- Home's top section (crew bar, Today card, Crew today) reads one batched `getHomeCrew` call (`src/lib/home-crew.functions.ts`); per-member today status, Mon–Sun dots and copy live in pure `src/lib/crew-today.ts` on top of streak-rules. Why: each member's day must use their own timezone and match the weekly line, without one query per member.
- "New member" (How Pactara works pill and tooltip) means account age from `profiles.created_at`, via `src/lib/new-member.ts`. Why: group join dates made long-time members look new whenever they started a group.
