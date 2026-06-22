## What we're building

The in-app experience after signup/login, with the rule: **if the user's group has only them in it (no invited members), open the full-page Invite Friends screen immediately. Otherwise, open the Home feed.**

## Backend (Lovable Cloud)

Three tables, all with RLS + GRANTs:

- `profiles` — `id (= auth.users.id)`, `name`, `avatar_color`. Auto-created on signup via trigger.
- `groups` — `id`, `name` (e.g. "Lose weight Crew"), `emoji`, `owner_id`, `created_at`.
- `group_members` — `id`, `group_id`, `user_id`, `joined_at`. Unique on (group_id, user_id).

A group is considered "needs invite" when `count(group_members where group_id = X) <= 1`.

The existing signup flow will be wired up to actually create:
1. An auth user (email + password)
2. A profile row (via trigger)
3. A group based on the goal they picked
4. A `group_members` row for themselves

## Routing

New protected subtree `src/routes/_authenticated/` (managed gate redirects to `/login` when signed out):

- `_authenticated/route.tsx` — gate
- `_authenticated/home.tsx` — feed screen (screenshot 1)
- `_authenticated/invite.tsx` — full-page invite (screenshot 3)

Update `login.tsx` and the signup completion step to actually authenticate via Cloud, then `navigate({ to: "/_authenticated/home" })`.

## The gating logic

A small loader on `_authenticated/home.tsx` calls a `getMyGroupStatus` server function. If `memberCount <= 1`, it throws `redirect({ to: "/invite" })`. Otherwise renders the feed.

Invite page has "Invite friends" (native share / copy link), "Copy link", and a "Not now" link that routes back to `/home` and sets a session-scoped "dismissed" flag so we don't bounce them back into the invite page on every nav — but the next fresh login will show it again until they actually have members.

## Out of scope this turn

Full Home feed interactivity (check-ins, posts, reactions) — Home will render a static version of screenshot 1 wired to the user's real name/group name. Real check-in/post functionality comes later. Bottom tab bar will be visual only.

## Files

New:
- migration creating `profiles`, `groups`, `group_members` + trigger + RLS + GRANTs
- `src/lib/groups.functions.ts` (`getMyGroupStatus`, `createGroupForUser`)
- `src/routes/_authenticated/route.tsx`
- `src/routes/_authenticated/home.tsx`
- `src/routes/_authenticated/invite.tsx`

Edited:
- `src/routes/login.tsx` — wire to `supabase.auth.signInWithPassword`, redirect to `/home`
- `src/routes/signup.tsx` — final step calls `supabase.auth.signUp` + `createGroupForUser`, then redirects

Confirm and I'll build it.