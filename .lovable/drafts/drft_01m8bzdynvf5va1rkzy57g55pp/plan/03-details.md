## b) Proposed new-version routes and entry points

Same URLs as classic where a route already exists, so notifications, share links and deep links keep working for both versions. Each route renders `New...` when `useAppVersion() === "new"`.

| Screen | Route | Entry points in the new nav |
|---|---|---|
| Discover (Plans, Workouts tabs) | `/groups?tab=plans\|workouts` (existing route, plus a `tab` param next to the existing filter params) | Discover tab. Posts, Meals, People tabs and From creators not rendered |
| Plan page | `/plans/$slug` | Discover Plans tab, quiz results, match card, Profile Plans, shared plan links, Home plan banner |
| Plan day | `/plans/$slug_/day?week=&day=` | Plan page day rows, Home Today card ("Next workout"), plan progress |
| Plan quiz | `/find-plan?step=...` | Discover Plans tab "Find your plan" card, match card Retake / See all matches |
| Workout page | new `/workouts/$workoutId` | Discover Workouts tab, builder Save, Profile, shared workout copies, crew chat workout cards |
| Workout builder | new `/workouts/new` and `/workouts/$workoutId_/edit` (classic `?edit=` link redirects there in new only) | + Create sheet "Build a workout" (today a "soon" row), Workout page secondary button (own workout) |
| Workout logger | `/workout/log` | Start now on Workout page, Start workout on Plan day, + Create check-in when a workout is running, Home running-workout bar |
| Exercise page | `/exercises/$exerciseId?tab=howto\|progress&swap=` (how-to route redirects into it in new only) | Workout page rows, logger card drawing / •••, builder rows, plan day rows, Profile Your progress lifts |

"Build a plan" in + Create stays "soon" (that is creator content, phase 6). No dead ends: any button whose target is not built yet is left out, not shown disabled-with-no-reason.

## c) Data that does not exist yet

Checked against today's tables: `workouts` has only name and an `exercises` list (exercise id, sets, rest); no equipment, tips, visibility, saves or "did it". `exercises` already has category, equipment, muscles, instructions, tips, both drawings and variation_group. `plans` has weeks, days, minutes, level, gear, summary, week notes.

| Need | Screen | Proposal (not added yet) |
|---|---|---|
| Workout equipment (Gym / Dumbbells / Home) | 3, 1, 8 | `workouts.equipment` text, nullable; prefilled from exercises' equipment in the builder |
| Author tip per exercise | 3, 1, 4 | Optional `tip` (max 120 chars) inside each item of `workouts.exercises`; no new table |
| Per-exercise reps target ("3 x 10") | 1, 3 | Optional `reps` in each workout item (today only sets and rest are stored) |
| Rest timer -15s / +15s / Skip | 2 | Already in-session state (`active-workout.ts` restSeconds); adjusting is local only. No setting table. Optional later: remember last rest per exercise in the same local state |
| Author line "from <author>" | 1, 2 | Exists for copies (`source_user_id`); own workouts say "by you". No change |
| Public workouts by other people, saves count, "did it" count | 1, 8 | Needs a visibility decision. Proposal: `workouts.is_public` (default false, off for private accounts), saves = count of copies via existing `source_*` columns, did it = distinct people with a logged `workout_sessions` row for the workout or its copies, exposed only through an RPC returning counts. Until decided, Discover Workouts shows your own saved workouts plus workouts crewmates shared to your crews |
| "X people are doing this plan" | 5 | Count of active `user_plans` per plan through a security-definer RPC (count only). Friend line reuses `crew_on_plan` |
| Exercise "change over N weeks", next target | 4 | Computed from `workout_set_logs` via `getExerciseProgress` + `lift-rules.ts` progression tip; pure helper, no new data |
| Crew name in plan day footer | 6 | Existing `getMyGroupStatus`; no change |

Privacy screen lines about workouts get added only in the phase that enforces them (per the existing rule).

## d) Suggested build order (one flow per message)

1. Discover shell: Plans and Workouts tabs, new Plans list over existing filters (Workouts tab shows your saved workouts until public workouts are decided)
2. Plan page + start plan, plan ••• menu, end-plan confirm, plan progress (needs the "people doing this" count)
3. Plan day + Start workout handoff
4. Plan quiz (questions, loading, results, crew-day and saved-match variants, browse)
5. Workout page (adds equipment, reps and tip fields in one migration)
6. Workout builder (create and edit, tips, equipment chips, drag order)
7. Workout logger (rest bar, cards, swap/remove, finish into the existing check-in)
8. Exercise page (How to + Your progress tabs, swap carousel)
9. Public workouts, saves and did-it counts on Discover Workouts and Workout page, if you approve the visibility proposal

## Open questions for you

- Should members' workouts become public to anyone (new version), only to crewmates and followers, or stay private in this phase?
- Is "Home" equipment the same as "No equipment" in plan filters, or does it include bands and dumbbells?

## Technical notes

- Version branch inside existing route files; no `_new` route tree. Classic components and server functions stay byte-identical; new reads, if any, are new server functions or RPCs.
- Pure rules per screen go in `src/lib/` with tests (workout page stats, logger rest math, exercise progress chart/next target, plan people line), following existing `workout-plans.ts` / `lift-rules.ts` patterns.
- Every new sheet uses `NewSheet`, every destructive step `NewConfirm`, top spacing `pt-new-top`.
