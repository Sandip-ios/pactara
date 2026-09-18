# Add member goals to the feed carousel

## What will change
- Add a third slide to the existing top-of-feed carousel titled “Our goals.”
- Show every member in the currently selected group with their avatar, name, and personal goal.
- Keep the card compact and aligned with the existing premium Pactara carousel styling; longer rosters will scroll inside the slide.
- Update the slide and its data automatically when the user switches groups or refreshes the feed.

## Technical details
- Extend the existing group-member summary request to include each membership’s `personal_goal`, preserving current group access controls.
- Pass the active group’s member goal data into `TodaySnapshot`.
- Increase the carousel to three slides and render the goals slide with accessible navigation dots and profile links.
- Verify types, the app build, and the mobile layout.
