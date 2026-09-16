# Profile page: Instagram-style, viewable by groupmates

## What you'll get

A profile with a compact header (avatar, name, three inline stats), one action button,
and tabbed content below — starting with a grid of check-in photos and videos.

Tapping a member's avatar anywhere in the app (group page, feed, chat) opens their profile.
Visitors only see check-ins from the group they share with you — nothing from your other groups.

## Layout

Own profile and someone else's use the same screen:

```text
        [ avatar ]      12        7        94%
                     check-ins  streak   on-time
   Jose
   🔥 FitFam · Day 8 of 90

   [ Settings ]            (own profile)
   [ Message  ]            (someone else's — opens the group chat)

   ── tabs ──────────────────────────
   [ Posts ] [ Badges ] [ Stats ]

   [img][vid][img]
   [img][img][vid]
```

- **Posts** — 3-column square grid, newest first, small play icon on videos.
  Tapping a tile opens the existing full-screen media viewer.
  Empty state: a quiet "No check-ins yet".
- **Badges** — the earned-badge wall that's on the profile today. Visible on both own
  and other people's profiles.
- **Stats** — the 7/90-day history, check-in rate, this week vs last week, streak freezes.
  Streak freezes are actionable only on your own profile.

No bio line, no share-profile button. Sign out and account settings stay behind the
Settings button on your own profile.

## Messaging someone

The Message button opens the existing group chat for the group you share, since Pactara
chat is group-based today. If you'd rather it start a one-to-one thread, that's a separate
build (new direct-message table and inbox) — say the word and I'll plan it.

## Visibility rules

- A profile is viewable only by people who share at least one group with you.
- The grid and stats are always scoped to one group: the group you and the viewer share.
  If you share several, the viewer gets a group switcher limited to those shared groups.
- Media stays private — each tile gets a short-lived signed link, nothing publicly downloadable.

## Technical notes

- New route `/_authenticated/u/$userId` rendering a shared `ProfileView` component;
  existing `/profile` reuses it in "own profile" mode.
- New server function `getMemberProfile({ userId, groupId })` (authenticated): verifies the
  caller and target share the group, then returns name, avatar, stats, badges, and the
  check-in media list.
- Check-in grid reads `check_ins` filtered by `user_id` + `group_id`; media paths signed in
  one batched `createSignedUrls` call against the `chat-photos` bucket.
- Database RLS already limits `check_ins` and `profiles` reads to groupmates; no migration needed.
- Member avatars across the app become tappable links to the new route.
