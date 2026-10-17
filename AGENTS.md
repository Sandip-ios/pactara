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
