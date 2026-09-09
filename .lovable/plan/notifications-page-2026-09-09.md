# Notifications page

A new Notifications screen, reachable from a bell button in the home header, showing recent activity in a group — comments, reactions, likes, chat messages, check-ins and new members — grouped into "Last 7 days" and "Last 30 days", Instagram-style.

## Bell button

- Sits to the right of the "How Pactara works" pill in the home header.
- Shows a red number badge when there are unread items (capped at 99+).
- Tapping it opens the Notifications page.

## Notifications page

- Header: back arrow, title "Notifications", and the group name with a chevron.
  Tapping the group name opens the existing bottom sheet to switch groups, so the
  list shows one group at a time.
- Sections: "Last 7 days" and "Last 30 days" (anything older is not shown).
- Each row: a person's profile photo on the left (with a small coloured glyph badge
  for the type — heart for reactions/likes, speech bubble for comments/chat, flame
  for check-ins, people for new members), the sentence in the middle, relative time,
  and a thumbnail of the related photo/video on the right when one exists.
- Unread rows are bold with a faint purple tint; read rows are regular weight.
- Tapping a row marks it read and jumps to the right place: the post's comments,
  the group chat, or the group page.
- Empty state when there is nothing yet.

## Read state

Opening the page does not clear everything — a row becomes read when tapped,
matching how the chat and comment badges already behave. A "Mark all as read"
action in the header handles the rest.

## Wording examples

- "Maya commented on your check-in"
- "Chris reacted 🔥 to your check-in"
- "Sam liked your comment"
- "Alex sent a message in Morning Milers"
- "Jordan checked in"
- "Taylor joined the group"

## Technical notes

- New table `notification_reads (user_id, item_key text, read_at)` with RLS scoped to
  `auth.uid()` and grants for `authenticated` / `service_role`. An item key is
  `<type>:<row id>` so no backfill or event table is needed.
- New `src/lib/notifications.functions.ts`:
  - `getNotifications({ groupId })` — reads the last 30 days from `post_comments`,
    `comment_likes`, `post_reactions`, `group_messages`, `check_ins` and
    `group_members`, excludes the current user's own actions, filters comments/likes
    to threads the user is part of, joins profile names/avatars (signed URLs) and
    media thumbnails, sorts by time, and marks each item read/unread from
    `notification_reads`.
  - `getUnreadNotificationCount()` — same derivation across all the user's groups,
    count only; used by the bell badge with a 30s refetch.
  - `markNotificationsRead({ keys })` — upserts read rows.
- New route `src/routes/_authenticated/notifications.tsx` reusing
  `GroupSwitcherSheet` and `listMyGroups`.
- Home header gains the bell button; no other screens change.
