# Correct onboarding funnel

## Goal
Make the founder funnel follow Pactara’s real onboarding screens instead of using later product milestones as onboarding steps.

## Changes
- Track each signup screen as it is reached: Name, Email, Profile photo, Consistency, Duration, Group name, Social proof, Password/account creation, Invite friends, Notifications, Greeting, Paywall, Personal goal, and Pact.
- Keep creator and invite-link paths distinct so skipped creator-only screens do not look like drop-offs.
- Build the onboarding chart from unique signup journeys started in the selected period.
- Move First check-in, Second check-in, Group has another member, and Active subscriber into a separate post-onboarding activation section.
- Label historical gaps clearly: exact screen-level tracking starts when this update ships; durable milestones such as account, goal, pact, and check-ins can still use existing records.

## Technical details
- Add a privacy-safe onboarding event table keyed by an anonymous journey ID, with an optional account ID once signup succeeds.
- Record screen views through a validated server function; no names, emails, goal text, or other personal content is stored in analytics events.
- Update founder analytics aggregation and funnel UI to calculate non-negative, path-aware conversions.
- Verify the creator and invitee flows, dashboard rendering, and latest build status.
