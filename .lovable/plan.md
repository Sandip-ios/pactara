# Profile page: Instagram-style, viewable by groupmates

## What you'll get

A profile that looks like the reference: a compact header (avatar, name, short bio line),
three inline stats, action buttons, and a **grid of your check-in photos and videos** below.

Tapping a member's avatar anywhere in the app (group page, feed, chat) opens their profile.
Visitors only see check-ins from the group they share with you — nothing from your other groups.

## Layout

Top (own profile and someone else's use the same screen):

```text
        [ avatar ]      12        7        94%
                     check-ins  streak   on-time
   Jose
   🔥 FitFam · Day 8 of 90

   [ Settings ]  [ Share profile ]        (own profile)
   [ Message   ]                          (someone else's)

   ── grid ──────────────────────────
   [img][vid][img]
   [img][img][vid]
```

- Grid is 3 columns, square tiles, newest first, videos marked with a small play icon.
- Tapping a tile opens the existing full-screen media viewer.
- If the person has no check-ins yet: a quiet "No check-ins yet" placeholder.

Everything already on the profile today (badges, streak freezes, 7/90-day history, sign out,
account settings) stays — it moves below the grid and only shows on your own profile.

## Visibility rules

- A profile is viewable only by people who share at least one group with you.
- The grid is always scoped to one group: the group you and the viewer share. If you share
  several, the viewer sees a group switcher limited to your shared groups.
- Media stays private storage — each tile gets a short-lived signed link generated on request,
  so nothing is publicly downloadable.

## Technical notes

- New route `/_authenticated/u/$userId` rendering a shared `ProfileView` component; the existing
  `/profile` reuses it in "own profile" mode.
- New server function `getMemberProfile({ userId, groupId })` (authenticated): verifies the
  caller and target share the group, then returns name, avatar, stats, and the check-in media
  list (photo/video paths signed in batch).
- Check-in grid reads `check_ins` filtered by `user_id` + `group_id`; media paths signed via the
  `chat-photos` bucket in one `createSignedUrls` call.
- Database RLS already limits `check_ins` and `profiles` reads to groupmates; no migration needed.
- Avatars anywhere that currently render a member become tappable links to the new route.
