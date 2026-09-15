# Pact notifications

Add notifications around making the pact, using the same pattern as check-ins and joins: the notifications list is derived from real data (no new table), and a push is sent at the moment it happens.

## Notifications to add

1. **Someone made the pact** — when a group member swipes to make the pact, everyone else in the group gets a push and a row in the notifications list: "Amevi made the pact".
2. **The pact is complete** — when the last member makes it, everyone in the group gets one celebratory notification: "Everyone's in — the pact is made. Time to show up."
3. **Waiting on you** — if a member still hasn't made the pact 24h after being invited/joining, a single nudge to that person only: "Your group is waiting on you to make the pact." Sent once, from the existing evening reminder job, never repeated and never shown to the rest of the group.

Not included (kept deliberately quiet): no notification to the person who just made the pact themselves, no repeated chasing of members who haven't made it, no "X is still waiting" messages to the group — that would shame unsigned members, which the pact screen deliberately avoids.

## Behaviour details

- Pushes open the pact screen for the group if you haven't made it yet, otherwise the group's feed.
- The new notifications count toward the bell badge and app icon badge like every other kind, and clear when opened.
- Group filter on the notifications page treats them like any other group activity.
- Nothing fires for existing members who were retroactively asked to make the pact before this change ships — only signatures from now on.

## Technical notes

- `NotificationKind` gains `pact_signed` and `pact_complete`; both are derived in `collectForGroup` from `group_members.pact_signed_at` (30-day window), so no migration is needed for the list. Keys: `pact:<groupId>:<userId>` and `pact_done:<groupId>`.
- `pact_complete` is derived: emitted when every member row has `pact_signed_at`, dated at the latest signature.
- `signPact` fans out push via `notify.server` (`group_activity_enabled` preference) to other members, plus the completion push when the update makes the group whole.
- The 24h nudge is added to the existing evening reminder cron, guarded by `joined_at < now - 24h` and a `pact_nudged_at` column on `group_members` so it only sends once.
- Badge counts flow through the existing `syncBadgeCount` since it counts collected items minus `notification_reads`.
