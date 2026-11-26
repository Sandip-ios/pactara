# Phase 4: Workouts and plans (new version only)

Every screen below branches on `useAppVersion()` inside the existing route file, the same way Profile and Crews did. Classic keeps its current component tree untouched; the new look lives in `src/components/redesign/` (prefix `New...`). None of today's workout or plan routes are version-gated yet, so each build message adds that branch.

## a) What exists today, and what the new version reuses

| # | Screen | Classic route / components | Server functions and pure rules | Reuse as-is under new look |
|---|---|---|---|---|
| 1 | Workout page | No standalone page. Saved workouts open inside `MyWorkoutsFlow` (Workouts tab, Start a workout). Shared copies: `/w/$code` | `getWorkoutDetail`, `getMyWorkouts`, `deleteSavedWorkout` (lifts.functions); `workout-builder.ts` (time estimate); share: `shareSavedWorkout`, `getWorkoutSharePanel`, `sendWorkoutToCrew`, `saveSharedWorkout` | All data and share functions. New page UI only |
| 2 | Workout logger | `/workout/log` (`workout.log.tsx`), `WorkoutBar`, `RestAlarm`, `ExercisePicker`, `ConfirmSheet`, `useStartWorkout` | `startLoggedSession`, `finishLoggedSession`, `getLiftHistory`; `active-workout.ts` (in-progress state, restSeconds already per exercise), `lift-rules.ts` (prefill, last time, PRs) | All logic, rest alarm, finish path into `recordCheckIn({ workoutSessionId })`. New UI only |
| 3 | Workout builder | `WorkoutBuilder.tsx` inside `MyWorkoutsFlow` (New/Edit workout), `ExercisePicker` | `saveBuiltWorkout`, `createCustomExercise`; `workout-builder.ts` | Save/edit/picker logic. Needs new fields (name and order exist; equipment and tips do not) |
| 4 | Exercise page | `/exercises/$exerciseId` (progress) and `/exercises/$exerciseId_/how-to` | `getExerciseProgress`, `getLiftHistory`; `how-to-view.ts`, `lift-rules.ts`, `exercise-library.ts` (swap by variation_group) | All data. New page merges both into one route with two tabs |
| 5 | Plan page | `/plans/$slug` (`plans.$slug.tsx`), `PlanBits`, `PlanSheets` (switch/leave), `PlanSharePanel`, `BodyMap` | `listPlans`, `getMyPlans`, `startPlan`, `leavePlan`, `getCrewOnPlan`; `workout-plans.ts`, `plan-share.ts` | All, incl. free start, switch, end, resume/start over. Needs a "people doing this plan" count |
| 6 | Plan day | `/plans/$slug_/day?week=&day=` | `plan-day-view.ts`, `plan-checkin.ts`, `useStartWorkout`, `BodyMap` | All, incl. plan tag only on the next day. Crew name for the footer comes from `getMyGroupStatus` |
| 7 | Plan quiz | `/find-plan` (`find-plan.tsx`), `QuizMatchCard`, `FindPlanCard` | `plan-quiz.ts`, `plan-quiz-saved.ts`, `plan-filters.ts` | All matching, URL steps, saved answers, browse fallback. New UI only |
| 8 | Discover Workouts / Plans tabs | `/groups` (`groups.index.tsx`) = `PlansDiscover`, `PlanFilterSheet`; Workouts tab is `/workouts` (`workouts.tsx`) | `listPlans`, `plan-filters.ts` (search params), `getWorkoutsOverview` / `workouts-tab.ts` | Plans tab: all filters and URL params. Workouts tab: needs a source of workouts to discover (see c) |

Shared redesign kit reused everywhere: `NewSheet` (swap/remove, plan •••, filters), `NewConfirm` (end plan, remove exercise, discard workout), `pt-new-top`, `NewAvatarFallback`, `NewBottomTabs`.
