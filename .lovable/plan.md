# Founder dashboard with real Pactara numbers

Today the private dashboard at `/admin` exists but every number on it is invented placeholder data. This turns it into a real, live dashboard fed by your own backend, plus App Store downloads.

## Access

The dashboard stays outside the app (no link from any app screen) and is protected by a secret link:

- You open it once with `pactara.app/admin?key=<secret>`; the key is remembered on that device.
- Without a valid key the page shows nothing and loads no data.
- The key is stored securely on the server side, never in the code.

## What the dashboard will show (real data)

**Acquisition**
- App Store downloads, by day and by week (from App Store Connect)
- New accounts created, by day
- Download to signup conversion

**Onboarding funnel** — how many people reach each step, with drop-off between each:
downloads → account created → group created or joined → invites sent → personal goal set → pact signed → first check-in → second day check-in

**Engagement**
- App opens per day, and average opens per active user per day (starts counting from the day this ships)
- Daily, weekly and monthly active users
- Check-ins per user per week, completion rate, missed rate
- Streak distribution and how many people hold a streak of 3, 7, 14, 30+

**Invites and virality**
- Average invites sent per group creator
- Invite acceptance rate
- Average group size, share of solo groups (a real problem indicator)

**Retention and lifetime**
- Day 1 / 7 / 30 retention by signup week
- Average days a member stays active before going quiet
- Group survival: how many groups are still checking in after 7, 14, 30 days

**Revenue**
- Active subscriptions, trials, conversion rate, churn (from existing subscription records)

Each number keeps a short plain-language explanation of what it means and what to do when it moves.

## Technical approach

1. **App opens tracking** — new `app_events` table (user, event, occurred_at, platform) written on app launch/foreground from the existing native bootstrap. Row-level security: insert own rows only, no client reads.
2. **Onboarding step tracking** — most steps are already derivable from existing tables (accounts, group_members, personal_goal, pact_signed_at, check_ins). Downloads and app opens are the only ones needing new collection.
3. **Server data layer** — `src/lib/admin/analytics.functions.ts` exposes one server function per dashboard section. Each validates the secret key, then runs aggregate SQL with the service-role client. No raw personal data is returned, only counts and rates.
4. **App Store Connect** — a small server helper signs a JWT with your App Store Connect key and pulls the sales/installs report daily; results cached in an `app_store_daily` table so the dashboard is fast and quota-safe. I will ask you for the Issuer ID, Key ID and the `.p8` key file contents.
5. **Pages** — the existing `/admin` pages keep their layout and switch from `buildAnalytics` (demo) to the real server functions; the "Demo data" badge is removed. Date range selector (today / 7d / 30d / 90d) drives every query.
6. Dashboard routes stay `noindex` and are excluded from the app's navigation.

## Also in this pass

Two security issues in the backend need fixing and are included: profile records are currently readable by any signed-in user (will be scoped to groupmates only), and avatar files are downloadable by anyone (will be scoped to signed-in groupmates).

## Not included

- Attribution by ad campaign (needs an install-attribution provider)
- Android numbers (no Play Store build yet)
- Historical app opens before this ships
