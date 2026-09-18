# Personal goals instead of group goals

Today the person creating a group picks one challenge (Lose weight, Build muscle, 75 Hard…) and everyone inherits it. This change makes the goal personal: the group is just the container, and every member writes their own goal in their own words before they make the pact.

## What changes for people using the app

**Creating a group** — the "What's your challenge?" step disappears from both signup and the "New Pactara" flow. Creating a group becomes: name the group, choose how many days, invite people. The group keeps a neutral icon instead of a challenge icon, and the suggested group name no longer comes from a challenge.

**New "What's your goal?" page** — matching the reference image:
- Progress bar and back arrow at the top, purple target illustration
- Title "What's your goal?" with "Write the goal you want this group to help you stay accountable to."
- A text box with placeholder "Example: Work out 4 times a week" and a 0/120 counter
- Helper line: "This will appear at the top of your feed and on your profile as a reminder."
- Four tappable suggestions: 💪 Lose 10 pounds, 🏋️ Build muscle, 🏃 Run a 5K, 🥗 Eat 3 healthy meals a day
- A live preview card showing "YOUR GOAL" with the text typed
- Large purple "Continue →" button

**Who sees it and when** — every member of every group sees this page once per group, right before the pact page: the group creator, invited members, and existing users joining another group. Until it's filled in, the app routes you there, the same way the pact page works today. It cannot be skipped, but you can edit your goal later from the group's menu.

**Where the personal goal shows up** — at the top of the group feed for you, on your profile in that group, and on the pact page (your own goal instead of the group's).

**Existing groups and members** — anyone already in a group who has never set a personal goal will be asked for one the next time they open the app. Existing group-level goals stay stored but are no longer shown; they seed nothing new.

## Technical notes

- Migration: add `personal_goal text` and `personal_goal_set_at timestamptz` to `group_members` (nullable, additive). No drops; the `groups.goal` column stays in place unused by new writes.
- New server functions in `src/lib/member-goal.functions.ts`: `getMemberGoal({groupId})`, `setMemberGoal({groupId, goal})` (trim, max 120 chars), and `getPendingGoal()` returning the first group the user has joined without a personal goal.
- New route `src/routes/_authenticated/goal.$groupId.tsx` for the page above; hides bottom tabs via `useHideBottomTabs`.
- Gate in `src/routes/_authenticated/route.tsx`: run `getPendingGoal()` before the existing pact check and redirect to `/goal/$groupId` first, so the order is goal → pact → app. Pact and goal routes are excluded from the gate.
- `src/routes/signup.tsx`: drop the `goal` / `consistency`-adjacent goal step from `ALL_STEPS` and `INVITED_SKIP`, remove `GOALS`/`ICON_FOR_GOAL` usage, the 75-Hard duration branch, and the goal-derived default group name (use "My Crew" / the entered name). Keep `GoalStep` exports only if still referenced; otherwise remove.
- `src/routes/_authenticated/new-pactara.tsx`: same removals; `createGroupForUser` no longer sends `goal`, and `emoji` defaults to 🔥.
- Display swaps: group feed header, profile, and `pact.$groupId.tsx` read the member's `personal_goal` instead of `group.goal`; `groups.index.tsx` / `groups.$groupId.tsx` subtitles drop the group goal prefix.
- Edit path: "Edit my goal" entry in `GroupOverflowMenu` reusing the same page.
