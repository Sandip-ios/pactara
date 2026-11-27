## Conflicts with the current code (please decide)
1. **Video length.** We do not store a video's length anywhere. Proposal: read it in the browser from the video file's info (loads only a small part of the file, only near the screen, as today's feed does) and show the pill once known; hide it until then. No database change.
2. **Apple Health stats.** Only type, start, duration, distance and calories leave the phone. Heart rate and elevation are not stored, so those tiles never appear. Pace is computed from distance and time. Adding heart rate/elevation would need a phone-side change in a later App Store build.
3. **PR data includes weight.** The feed's PR text is built as "{exercise} {weight} {unit}". The new version gets a plain yes/no "has PR" plus which exercises set one; classic keeps its text.
4. **Several photos per day.** Today the new card swipes through all of a day's media. With one card per check-in, each card shows only its own media.
5. **Card margin.** Today's new card uses margin 0 12px 12px; your spec says 12px 12px 0. I will follow the spec.
6. **Header menus** (own-post menu, Report/Block) stay, now targeting that card's check-in.
7. **"Saved" state.** `saveCrewWorkout` already returns whether a copy exists; the button reads that so "Saved · Open in Workouts" also shows on reopen.
8. **Exercise sets in the sheet.** The crew workout sheet loader already returns sets; the new sheet drops weight and shows reps or times only. Timed exercises use the set's seconds.

## Sheets
- Workout (crewmate): author row, label + 22px title, 3 tiles (Time, Sets, Exercises), exercise list with 44px thumbnails and "{n} sets · reps..." lines, PR chips (check-ins always show them), weights note only if any weighted exercise, "Save to my workouts" then "Saved · Open in Workouts", Close.
- Workout (yours): same without author row, only Close.
- Plan day: label "PLAN · WEEK w, DAY d", title "{Plan}: {day}", same tiles and list, "View plan" opens `/plans/<slug>`, Close.
- Apple Health: 2-column tiles for stats that exist, "From Apple Health on {First name}'s iPhone." / "your iPhone.", Close.

## Technical details
- Migration (drizzle): `check_in_id uuid null references check_ins on delete cascade` on `post_reactions` and `post_comments`; replace the reactions unique key with one on (post_id, coalesce(check_in_id, zero uuid), user_id, emoji); insert rules also require the check-in to belong to the post. Database tests for: old rows show on first card, cheering two check-ins same day, cross-post check-in rejected, blocks still enforced.
- Server: feed loader returns per-check-in cheer/reply counts and reactors (rows with empty id assigned to the post's first check-in); cheer/comment functions accept optional `checkInId`. `CommentsSheet` scoped by check-in in redesign only.
- Pure helpers with tests in `src/lib/redesign-feed-view.ts`: split ordering, meta line ("6:12 am · Workout", "Yesterday · Run", no tag), attached-card label/title/line per kind, Health stat picks, sheet set line ("3 sets · 10, 8, 8 reps" / "0:45, 0:45, 0:30"), PR visibility (check-in always; post only own), weights note rule.
- New components: `RedesignAttachedCard`, `RedesignWorkoutSheet`, `RedesignHealthSheet` under `src/components/redesign/`.
- QA: the nine 390x844 screenshots into `public/qa/` with `p5-1d-` prefix, draft data only, temporary rows removed; full tests incl. database tests, typecheck, commit. No em dashes. Not published.
