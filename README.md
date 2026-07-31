# Pactara

Pactara — Full End-to-End Lovable Prompt Package

How to use this document. Each major section is self-contained. Feed the entire document to Lovable as context, then reference individual screen sections by name when requesting isolated mockups (e.g., "Build the Group Feed screen as described in Section 6.4"). Every screen section includes its own data requirements, states, and interaction rules so Lovable can generate a working demo without needing any other context.

Section 1 — What Pactara Is

Pactara is a mobile-first social accountability app for small, trusted groups of 3–10 people working toward a shared goal over a defined commitment period (7–90 days). It is not a fitness tracker, a to-do list, or a general social network. It is a structured daily ritual engine: every member posts a short morning commitment before noon, then checks in before midnight with a mood rating and optional photo. The group sees everyone's progress in a shared feed. Absence is visible. Encouragement is social. Streaks create momentum.

The product lives at pactara.app. The mobile app is a Capacitor-wrapped React PWA distributed on iOS and Android. The desktop experience is a marketing landing page only — the app itself is intentionally mobile-first.

Core Daily Loop

The entire product revolves around two actions per day, per group:

1.Morning Ritual — Before noon (user's local timezone), post a short sentence describing what you plan to do today toward the group goal. Example: "Going to the gym at 6am, leg day." This appears immediately in the group feed as the top half of that day's standup card.

2.Check-In — Before midnight (user's local timezone), tap the Check-In button, select a completion rating (Crushed It / Made Progress / Missed It), optionally add a photo and a note, and submit. This fills in the bottom half of the same standup card in the feed.

If a user misses their morning ritual, the feed automatically shows a "Missed Morning Ritual" card for them after noon. If a user misses their check-in, the midnight cron job marks the day as missed, the streak resets, and the standup card updates to show a red "Missed Check-in" node.

User Roles

Role

Description

Group Admin

Creates the group, sets the goal and commitment period, manages members, can start a new cycle

Group Member

Posts standups and check-ins, reacts, comments, nudges, chats

Free User

Can browse the feed but cannot post check-ins or use chat (paywall enforced)

App Admin

Internal role — access to admin dashboard, broadcast messages, user management

Section 2 — Design System

2.1 Visual Language

Pactara uses Warm Organic Minimalism — a design language that feels personal, grounded, and human. The aesthetic is closer to a premium wellness journal than a gamified fitness app. Key references: Strava for the activity card pattern, Notion for typographic clarity, and early Instagram for the intimacy of a small-group feed.

2.2 Color Palette

Token

Hex

Usage

--cream

#FAF7F2

Page background, card backgrounds

--amber-warm

#E8A838

Primary accent, streak fire icons, CTA buttons

--amber-light

#FFF3D6

Pill backgrounds, highlight fills

--charcoal

#1C1917

Primary text

--stone-500

#78716C

Secondary text, timestamps, labels

--stone-200

#E7E5E4

Dividers, borders, card outlines

--green-success

#22C55E

Crushed It state, streak milestone badges

--amber-progress

#F59E0B

Made Progress state

--red-missed

#EF4444

Missed state, streak-reset indicator

--white

#FFFFFF

Card surfaces, modal backgrounds

Dark mode is not supported in v1. The app is always light-mode with the cream background.

2.3 Typography

•Display / Hero: Fraunces (Google Fonts, serif, variable weight) — used for large headings, onboarding titles, and the landing page hero

•Body / UI: Inter (Google Fonts, sans-serif) — used for all body text, labels, buttons, and form fields

•Monospace / Dates: JetBrains Mono — used sparingly for streak counters and date stamps

Type scale:

Name

Size

Weight

Usage

Display

32px

700

Onboarding hero, landing page H1

Heading 1

24px

700

Screen titles

Heading 2

18px

600

Card titles, section headers

Body

15px

400

Feed content, notes, chat messages

Caption

13px

400

Timestamps, labels, metadata

Micro

11px

500

Pill labels, badges

2.4 Spacing & Layout

The app uses an 8px base grid. All padding, margin, and gap values are multiples of 4px or 8px. Cards have 16px internal padding. The bottom navigation bar is 64px tall with a safe-area inset below it. The content area scrolls behind a fixed bottom nav.

2.5 Component Anatomy

Standup Card (the primary feed unit):

Plain Text

┌─────────────────────────────────────────┐ │ [Avatar 40px] [Name] [Group badge] [Time] │ │ │ │ ● Morning Ritual │ ← amber dot, commitment text │ │ │ ← vertical connecting line │ ● Check-In: Crushed It 🔥 │ ← green/amber/red dot + mood │ "Smashed leg day, feeling great" │ ← optional note │ [Photo thumbnail if present] │ │ │ │ 🔥 3 💪 1 ❤️ 2 [Comment icon] 4 │ ← reaction row └─────────────────────────────────────────┘

Missed Ritual Card (synthetic, shown when morning ritual was skipped):

Plain Text

┌─────────────────────────────────────────┐ │ [Avatar] [Name] [Time: "Today"] │ │ │ │ 😴 Missed Morning Ritual │ ← amber/grey dot │ │ No plan was set for today │ │ ╌╌ Check-in pending… │ ← dashed grey line (or red if missed) │ │ └─────────────────────────────────────────┘

2.6 Mobile Layout Pattern

The app uses a bottom tab navigation with 4 tabs: Home (feed), Check-In, Groups, Profile. The Check-In tab is always visible and acts as the primary CTA. On iOS, the bottom nav respects the home indicator safe area. The top of each screen has a minimal header with the screen title and contextual action icons (no hamburger menus).

2.7 Interaction Principles

•Reactions are tap-to-toggle with a spring scale animation (1.0 → 1.3 → 1.0 over 200ms)

•Cards animate in with a subtle fade-up on initial load (opacity 0→1, translateY 8px→0, 250ms)

•The morning ritual sheet slides up from the bottom (bottom sheet pattern, 350ms ease-out)

•The check-in flow is a full-screen modal stack (not a bottom sheet) to emphasize its importance

•Pull-to-refresh is supported on all feed screens

•All avatar images use a 3-retry exponential backoff loader to handle cold-start latency

Section 3 — Backend Architecture

3.1 Stack Overview

Layer

Technology

Frontend

React 19, Tailwind CSS 4, Vite

API

tRPC 11 over HTTP (batched JSON)

Server

Node.js 22, Express 4

ORM

Drizzle ORM

Database

MySQL 8 (TiDB-compatible)

Auth

Magic-link email + JWT session cookies

File Storage

S3-compatible object storage

Push Notifications

Firebase Cloud Messaging (FCM)

Email

Resend API

Payments

Stripe

Mobile

Capacitor (iOS + Android wrapper)

Scheduled Jobs

Node-cron (4 jobs in server/scheduled.ts)

3.2 tRPC Procedure Types

All API calls go through tRPC. There are two procedure types:

•publicProcedure — No authentication required. Used for: invite code lookup, magic link request, magic link verification, landing page data.

•protectedProcedure — Requires a valid JWT session cookie. Used for: all feed, check-in, standup, chat, group management, and settings operations. If the cookie is missing or expired, the server returns a UNAUTHORIZED error and the client redirects to the login screen.

3.3 Authentication Flow

1.User enters their email on the login screen.

2.Server generates a 32-byte hex magic token, stores it in magic_tokens with a 30-minute expiry, and sends an email via Resend with a /verify?token=... link.

3.User clicks the link. Server validates the token (not expired, not used), creates or updates the user record, marks the token as used, issues a signed JWT stored as an HttpOnly session cookie.

4.All subsequent requests include the cookie automatically. The server validates the JWT on every request via the tRPC context middleware.

5.On mobile (Capacitor), magic links open the app directly via a deep link scheme.

3.4 Image Serving

All user-uploaded images (avatars, check-in photos, progress snapshots) are stored in S3 and served through a server-side proxy at /api/img/{key}. The proxy adds a 24-hour in-memory cache. Signed S3 URLs are never exposed to the client — all image references in the database and API responses use the /api/img/ path. This prevents URL expiry issues and keeps storage credentials server-side.

3.5 Scheduled Jobs

Four cron jobs run on the server:

Job

Schedule

Purpose

morning-motivation

8am user's local timezone

Push notification + email to all users with active groups

streak-at-risk

8pm user's local timezone

Push notification to users who haven't checked in yet today

noon-missed-ritual

12pm user's local timezone

Creates __missed_ritual__ post in DB for users who skipped morning ritual

midnight-missed-checkin

12:05am user's local timezone

Creates __missed_checkin__ post, resets streak for users who missed check-in

All jobs skip users with no saved timezone, skip groups whose commitment period has ended (cycleStartedAt + goalDurationDays < today), and respect per-user notification preferences.

Section 4 — Database Schema

The database has 17 tables. All timestamps are stored as UTC. All date strings use YYYY-MM-DD UTC format.

4.1 Table Summary

Table

Purpose

users

Core user accounts — auth, plan, Stripe IDs, avatar

group_members

Many-to-many: users ↔ groups, with role (member/admin)

invite_codes

Shareable join links — stores group config at time of creation

magic_tokens

Passwordless auth tokens — 30-minute expiry, single-use

group_standups

Morning ritual posts — one per user per group per day

group_checkins

Evening check-ins — one per user per group per day

group_posts

Free-text feed posts + system posts (__missed_ritual__, __missed_checkin__)

group_messages

Group chat messages — supports image attachments and quoted replies

group_message_reads

Last-read message ID per user per group — powers unread badge

post_reactions

Emoji reactions on feed items — toggle on/off, one per (user, post, emoji)

post_comments

Text comments on feed items

nudges

Rate-limited nudge records — max 1 per sender per recipient per day

notification_prefs

Per-user notification toggles + IANA timezone

email_log

Deduplication log for scheduled emails

device_tokens

FCM push tokens — one row per device per user

progress_snapshots

Private before/after photos + weight per user per group

member_checklist_progress

Onboarding checklist completion tracking (14-day window)

broadcasts

Admin broadcast messages to all users or a specific group

login_sessions

Login history — device, IP, location

streak_freezes

Streak freeze usage records — one per week per user per group

4.2 Key Relationships

The central entity is the group, identified by a string UUID (groupId). The invite_codes table stores the group's configuration (goal, duration, check-in frequency, nutrition tracking). group_members links users to groups. All activity tables (group_standups, group_checkins, group_posts, group_messages) reference groupId as a string foreign key.

A user's streak is computed at query time by counting consecutive days with a group_checkins row (or a streak_freezes row) going backwards from today. It is not stored as a column — this prevents drift between the computed value and the stored value.

The group_posts table serves double duty: it holds free-text posts (postType = "text") and system-generated missed markers (postType = "text" with content = "__missed_ritual__YYYY-MM-DD" or "__missed_checkin__YYYY-MM-DD"). The feed query merges standups, check-ins, and posts into a unified timeline sorted by createdAt.

Section 5 — Security Model

5.1 Authentication Gates

Every tRPC procedure that touches user data uses protectedProcedure. The JWT is stored as an HttpOnly, SameSite=Strict, Secure cookie — it is never accessible to JavaScript. Token expiry is 30 days with a rolling refresh on each authenticated request.

5.2 Authorization Rules

•Group membership is checked on every group-scoped query. A user can only read or write to groups they are a member of. The server queries group_members and throws FORBIDDEN if the user is not a member.

•Group admin actions (start new cycle, remove members, delete group) additionally check groupRole = "admin" in group_members.

•App admin actions (broadcast, user management, analytics) check users.role = "admin".

•Subscription gates are enforced server-side on protectedProcedure calls for check-in submission and chat. The server reads users.plan and throws PAYMENT_REQUIRED if the user is on the free plan. The client shows a paywall modal on this error.

5.3 Image Security

S3 bucket is private. No public URLs. All image access goes through /api/img/{key} which validates the session cookie before proxying the S3 response. The key is an opaque string — it does not encode the user ID or any guessable path. Uploaded images are validated for MIME type on the server before storage.

5.4 Invite Code Security

Invite codes are 8-character random strings. They have a configurable maxUses (default 50) and optional expiresAt. The join flow validates both before allowing a new user to proceed. A user who is already a member of the group cannot join again via the same code.

Section 6 — Page-by-Page Breakdown (Isolated Demo Units)

Each screen below is described as a self-contained demo unit. When prompting Lovable for a specific screen, paste the entire Section 6 header plus the relevant subsection. Each screen includes: purpose, key UI elements, user interactions, data it needs, and all states (loading, empty, error).

6.1 SCREEN: Splash / App Launch

Purpose: Shown for ~1.5 seconds while the app checks auth state. Establishes brand identity.

UI Elements:

•Full-screen cream background (#FAF7F2)

•Centered Pactara wordmark in Fraunces 700, 32px, charcoal

•Small amber flame icon above the wordmark

•Subtle fade-in animation (300ms)

States: Single state only — no loading spinner, no error state. After 1.5s, navigate to either the Home feed (authenticated) or the Welcome screen (unauthenticated).

Data needed: None — purely presentational.

6.2 SCREEN: Welcome / Landing (Unauthenticated)

Purpose: First screen for unauthenticated users. Converts visitors to sign-ups.

UI Elements:

•Full-bleed background: a warm, slightly blurred photo of a small group of people celebrating (amber/golden tones)

•Dark overlay (40% opacity) for text legibility

•Large display headline in Fraunces: "Show up. Every day. Together."

•Subheading in Inter: "Pactara keeps small groups accountable to the goals that matter most."

•Two CTA buttons stacked vertically:

•Primary (amber fill): "Start a Group"

•Secondary (white outline): "Join a Group"

•Small "Sign in" text link at the bottom for returning users

•Pactara wordmark top-left

Interactions:

•"Start a Group" → Onboarding flow (Section 6.3)

•"Join a Group" → Prompts for invite code or link

•"Sign in" → Login screen (Section 6.10)

States: Single state — no auth check needed here.

Data needed: None.

6.3 SCREEN: Onboarding Flow (Multi-Step)

Purpose: Collects goal, group name, commitment details, and profile photo from a new user before they reach the feed. Designed to be resumed if the user exits mid-flow.

Step 1 — Choose Your Goal

A vertically scrollable list of goal cards. Each card shows only the goal title until tapped, then expands to reveal a short description. Goals: Lose Weight, Build Muscle, Run Consistently, Eat Better, Quit a Habit, Read More, Learn a Skill, Custom Goal. A "Continue" button appears after selection.

Step 2 — Name Your Group

Single text input: "What will you call your group?" Placeholder: "e.g. Morning Warriors". Below it, a smaller input: "Your commitment in one sentence" — placeholder: "e.g. Work out 4x per week". Continue button.

Step 3 — Commitment Period

Segmented control: 30 days / 60 days / 90 days. Below it, a brief explanation of what a commitment period means. Continue button.

Step 4 — Goal Confirmation (Full-Bleed)

Full-bleed image specific to the selected goal (e.g., a runner for "Run Consistently", a kitchen scene for "Eat Better"). Dark overlay. Large text: "You're in good company." Subtext: "Thousands of people are working toward the same goal right now." Amber CTA: "Let's build your group →"

Step 5 — Profile Photo

Centered avatar placeholder (80px circle, dashed border). "Add a photo — your group will see this every day." Two options: Take Photo / Choose from Library. Skip link below. Continue button.

Step 6 — Trial Offer

Full-screen marketing card. Headline: "Try Pactara free for 7 days." Three benefit bullets with amber checkmarks. Pricing below: $9.99/mo after trial. Large amber CTA: "Start Free Trial". Small "No thanks, continue free" link.

Progress indicator: A thin amber progress bar at the top of the screen spans all 6 steps. Back chevron top-left on steps 2–6.

States:

•Loading: spinner on Continue button while magic link is sent

•Error: inline validation on empty fields

•Resume: if user returns mid-flow, show a "Continue where you left off" banner on the Welcome screen

Data needed: goal (string), groupName (string), commitment (string), goalDurationDays (30/60/90), avatarUrl (optional S3 key).

6.4 SCREEN: Home Feed (Main Feed Tab)

Purpose: The primary daily-use screen. Shows the merged activity feed for all groups the user belongs to. This is where the daily standup cards, missed-ritual cards, reactions, and comments live.

Layout:

•Sticky header: Pactara wordmark left, notification bell icon right (badge count if unread)

•Group selector tabs below header: horizontal scrollable pill tabs, one per group the user belongs to (e.g., "Morning Warriors", "Book Club"). "All" tab shows merged feed.

•Feed: vertically scrollable list of standup cards (see Section 2.5 for card anatomy)

•Floating amber "+" button bottom-right — opens the Morning Ritual composer sheet

Standup Card States:

•Full card: Morning ritual text + check-in result (mood, note, optional photo)

•Ritual only (check-in pending): Morning ritual text + dashed grey "Check-in pending…" row

•Missed ritual + check-in pending: Amber "😴 Missed Morning Ritual" + dashed grey "Check-in pending…"

•Missed ritual + missed check-in: Amber "😴 Missed Morning Ritual" + red "❌ Missed Check-in"

•Missed ritual + checked in: Amber "😴 Missed Morning Ritual" + green/amber check-in result

Reaction Row: Four emoji buttons (🔥 💪 ❤️ 👏) with counts. Tapping toggles the reaction. Tapping a count shows a list of who reacted.

Comment Row: Comment icon with count. Tapping opens a bottom sheet with the comment thread and a text input.

Nudge: On cards where the check-in is still pending and the user is not the author, a small "Nudge 👋" button appears. Tapping sends a push notification to that member. Rate-limited to 1 nudge per sender per recipient per day.

Morning Ritual Composer Sheet (bottom sheet):

•Slides up from bottom

•User avatar + text area: "What's your plan for today?"

•Character counter (max 280)

•Submit button (amber, disabled until text is entered)

•Keyboard-aware: sheet lifts with the keyboard, feed stays still

Feed States:

•Loading: skeleton cards (3 placeholder cards with shimmer animation)

•Empty (new group, no posts yet): Illustration + "Be the first to post your morning ritual"

•Error: "Couldn't load feed. Pull to refresh."

Pull-to-refresh: Supported. Amber spinner at top.

Data needed:

•standup.getGroupFeed({ groupId }) — returns merged timeline of standups, checkins, posts

•standup.getTodayMine({ groupId }) — whether current user has posted today

•reactions.getForFeed({ groupId }) — reaction counts and current user's reactions

•comments.getCount({ postId, postType }) — comment counts per card

6.5 SCREEN: Check-In Flow (Full-Screen Modal)

Purpose: The most important daily action. Non-dismissible — the user must complete or explicitly cancel. Accessed via the Check-In tab in the bottom nav.

Step 1 — Completion Rating

Full-screen with a warm gradient background. Three large tappable cards stacked vertically:

•🔥 Crushed It — "Fully accomplished my goal today" (green accent)

•💪 Made Progress — "Made meaningful progress" (amber accent)

•😔 Missed It — "Didn't make progress today" (stone/grey accent)

Tapping a card selects it with a scale animation and reveals the Continue button.

Step 2 — Add a Photo (Optional)

Camera viewfinder or photo picker. Large amber "Take Photo" button. "Choose from Library" link below. "Skip" link top-right. If a photo is taken, it fills the screen with an Instagram-style crop/confirm view. Activity tag overlay (meal / workout / run / progress / stats) appears top-right after photo confirmation.

Step 3 — Add a Note (Optional)

Clean text area: "How did it go? (optional)" Placeholder: "Share your experience with the group…" Character counter (max 500). For nutrition-goal groups, a meal counter also appears: "Healthy meals today: [0] [1] [2] [3] [4] [5] [6]" — tappable number pills. "Submit Check-In" amber button.

Paywall Gate: If the user is on the free plan, Step 1 is replaced by a paywall modal (see Section 6.14).

States:

•Submitting: spinner on Submit button, inputs disabled

•Success: brief full-screen celebration animation (confetti burst, 1.5s), then auto-dismiss to feed

•Error: toast "Couldn't save check-in. Try again."

•Already checked in today: the tab shows a green checkmark badge; tapping it shows "You've already checked in today 🎉"

Data needed:

•checkin.submit({ groupId, completion, mood, note, imageKey, activityTag, mealCount })

•users.me — to check plan and show paywall if needed

6.6 SCREEN: Group Chat

Purpose: iMessage-style group messaging, separate from the feed. Accessed via the Chat icon in the Group tab or a chat bubble icon in the feed header.

Layout:

•Header: group name, member count, info icon

•Message list: chronological, newest at bottom. Auto-scrolls to bottom on new message.

•Message bubbles: sender avatar left (others) or right (self). Sender name above bubble for others. Timestamp below bubble.

•Image messages: thumbnail inline, tap to full-screen

•Quoted replies: grey quoted block above the message bubble

•Input bar: text input + camera icon + send button. Keyboard-aware.

Unread badge: Red dot on the Chat tab icon when there are unread messages.

States:

•Loading: skeleton bubbles

•Empty: "No messages yet. Say hello 👋"

•Error: "Couldn't load messages. Pull to refresh."

•Sending: message appears immediately (optimistic) with a grey clock icon; replaced by timestamp on success

Data needed:

•chat.getMessages({ groupId, cursor }) — paginated, newest first

•chat.send({ groupId, content, imageKey, replyToId }) — mutation

•chat.markRead({ groupId, messageId }) — mutation on scroll to bottom

6.7 SCREEN: Groups Tab

Purpose: Overview of all groups the user belongs to. Entry point for group management, member list, and starting a new group.

Layout:

•Header: "My Groups" title, "+" icon to create a new group

•List of group cards, one per group:

•Group name (bold)

•Goal badge (e.g., "🏃 Run Consistently")

•Member avatars (up to 5, overlapping circles)

•Commitment period progress bar (e.g., "Day 14 of 30")

•Streak summary: "3 members on 🔥 streak"

•Tap to open Group Detail screen

States:

•Loading: skeleton cards

•Empty (no groups): "You're not in any groups yet." + amber "Start a Group" button + "Join with a code" link

Data needed:

•groups.list() — returns all groups for the current user with member count, streak summary, cycle progress

6.8 SCREEN: Group Detail

Purpose: Shows the full member list, group settings, invite link, and streak leaderboard for a single group.

Tabs within this screen: Members | Streaks | Settings (admin only)

Members Tab:

•List of members with avatar, name, current streak count, and today's status (✅ checked in / ⏳ pending / ❌ missed)

•"Invite Members" button at top — generates and copies the invite link

•Long-press on a member (admin only): Remove from group option

Streaks Tab:

•Ranked list: avatar, name, streak count with flame icon

•Current user highlighted

•Streak freeze status: "1 freeze available this week" (for eligible plan users)

Settings Tab (admin only):

•Group name (editable)

•Goal (read-only after creation)

•Commitment period: shows start date and end date

•"Start New Cycle" button — resets cycleStartedAt to today, does not erase history

•"Delete Group" button (destructive, confirmation required)

States:

•Loading: skeleton list

•Error: toast on failed operations

Data needed:

•groups.getDetail({ groupId }) — members, streaks, cycle info

•groups.generateInvite({ groupId }) — returns invite URL

•groups.startNewCycle({ groupId }) — admin mutation

•groups.removeMember({ groupId, userId }) — admin mutation

6.9 SCREEN: Profile Tab

Purpose: The user's personal profile — their stats, progress snapshots, settings access, and subscription status.

Layout:

•Header: avatar (80px), display name, member since date

•Stats row: [Current Streak 🔥] [Total Check-ins] [Groups]

•"Progress Snapshots" section: side-by-side before/after photo cards per group. Tapping opens the snapshot editor.

•"My Activity" section: mini calendar heatmap showing check-in history (last 90 days)

•Settings link (gear icon top-right)

•Plan badge: "Challenge Pass" or "Free" with upgrade prompt if free

States:

•Loading: skeleton layout

•No snapshots: "Add a before photo to track your transformation" + amber CTA

Data needed:

•users.me — plan, avatar, display name

•stats.getMine() — streak, total check-ins, group count

•snapshots.getMine() — before/after photos per group

6.10 SCREEN: Login / Sign In

Purpose: Returning user authentication via magic link email.

Layout:

•Centered card on cream background

•Pactara wordmark at top

•Headline: "Welcome back"

•Email input field (auto-focus)

•"Send Magic Link" amber button

•"Don't have an account? Start a group" link below

Validation:

•Empty email: "Please enter your email"

•Non-existent account: inline error on the email field: "No account found for this email. Start a group instead?"

•Invalid email format: "Please enter a valid email address"

Post-submit state: Input and button replaced by: "✉️ Check your email — we sent a magic link to [email]." with a "Resend" link (rate-limited to 60 seconds).

Data needed:

•auth.requestMagicLink({ email }) — mutation

6.11 SCREEN: Magic Link Verification

Purpose: Handles the /verify?token=... URL from the magic link email. On mobile, this deep-links into the app.

Layout:

•Full-screen cream background

•Centered: amber spinner while verifying

•Success: brief "✅ You're in!" message, then redirect to feed or onboarding

•Error: "This link has expired or already been used." + "Request a new link" button

Data needed:

•auth.verifyMagicLink({ token }) — mutation (called automatically on mount)

6.12 SCREEN: Join Group (via Invite Link)

Purpose: Landing screen for users who tap a group invite link. Shows group preview to incentivize joining.

Layout:

•Full-bleed background image (goal-specific)

•Group name in large Fraunces display text

•Goal badge

•Member preview: 2–3 member avatars with names ("Alex, Jordan, and 4 others are in this group")

•Commitment period info: "30-day challenge · Day 8 of 30"

•Large amber CTA: "Join [Group Name]"

•If user is already logged in: skip email step, go straight to confirmation

•If new user: email input → magic link → profile photo prompt → feed

States:

•Invalid/expired code: "This invite link is no longer valid." + "Start your own group" link

•Already a member: "You're already in this group 👋" + "Go to feed" button

Data needed:

•invites.getPreview({ code }) — public procedure, returns group name, goal, member previews, cycle info

6.13 SCREEN: Settings

Purpose: User preferences, notification settings, subscription management, and account actions.

Sections:

Profile: Display name (editable), email (read-only), avatar (replaceable), first/last name.

Notifications: Toggle list — Morning Motivation, Streak at Risk, Reactions, Comments, Chat Digest, Weekly Recap, New Member Alerts, Group Streak Milestones. Preferred morning notification time (time picker).

Subscription: Current plan badge. If free: upgrade CTA with plan comparison table. If subscribed: renewal date, "Manage Subscription" link (opens Stripe portal). Streak freeze availability (annual plan only).

Security: Login activity list (device, location, date). "Log out of all devices" button.

Account: "Log Out" button. "Delete Account" link (destructive, confirmation required).

Data needed:

•users.updateProfile({ displayName, firstName, lastName, avatarKey }) — mutation

•notifications.getPrefs() / notifications.updatePrefs({ ... }) — query + mutation

•auth.getLoginSessions() — query

•stripe.getPortalUrl() — mutation (returns Stripe billing portal URL)

6.14 SCREEN: Paywall Modal

Purpose: Shown when a free user tries to check in or use chat. Converts free users to paid.

Layout:

•Bottom sheet (not full-screen) — the feed is visible blurred behind it

•Amber flame icon at top

•Headline: "Unlock Pactara"

•Three benefit lines with amber checkmarks:

•"Daily check-ins to track your progress"

•"Group chat to stay connected"

•"Streak tracking and milestone badges"

•Plan comparison: two cards side by side

•Challenge Pass: $9.99/mo

•Annual Unlimited: $99/yr (streak freeze included)

•Large amber "Start 7-Day Free Trial" button

•Small "Continue browsing free" dismiss link

States:

•Loading (after tapping trial button): spinner

•Redirect: opens Stripe Checkout in a new browser tab

Data needed:

•stripe.createCheckoutSession({ plan }) — mutation

6.15 SCREEN: Progress Snapshots

Purpose: Private before/after photo comparison per commitment period. Only visible to the user themselves.

Layout:

•Header: "My Progress" + group name selector

•Two cards side by side: "Before" and "After"

•Each card: photo (if set) or dashed placeholder with "+" icon, weight field below (optional, in lbs)

•"Update" button per card

•Side-by-side comparison view when both photos are set

States:

•No photos: placeholder cards with "Add your before photo to start tracking"

•One photo: before card filled, after card shows placeholder

•Both photos: comparison view with a subtle divider line

Data needed:

•snapshots.getMine({ groupId }) — query

•snapshots.upsert({ groupId, snapshotType, photoKey, weightLbs }) — mutation

6.16 SCREEN: Notification / Invite Prompt (Full-Page Takeover)

Purpose: Shown on first login if the user has not yet invited anyone to their group. Designed to drive invites before the user reaches the feed.

Layout:

•Full-screen overlay (not dismissible via back button)

•Illustration: two people high-fiving

•Headline: "Your group is waiting for you."

•Body: "Accountability works best with real people. Invite your friends to join [Group Name] — they're probably struggling with the same goals."

•Large amber "Invite Friends" button — copies invite link + opens share sheet

•Small "Skip for now" text link at the bottom

Data needed:

•invites.generateLink({ groupId }) — mutation

Section 7 — Desktop Landing Page (pactara.app)

The desktop landing page is a marketing-only page — the app itself is not accessible on desktop. On mobile (< 768px), the page renders the MobileSplash component (the app-style onboarding splash). On desktop (≥ 768px), it renders a full marketing page. The two experiences are toggled with a CSS media query: .home-mobile-only and .home-desktop-only.

Authenticated users who land on / are immediately redirected to /app regardless of device.

7.1 Design Language

The desktop page uses a GlamUp.ai-inspired aesthetic: white background (#FFFFFF), generous whitespace, bold Plus Jakarta Sans headings (800 weight), one Dancing Script italic accent word per headline for warmth, and phone mockup screenshots alternating left/right in feature sections. The primary brand accent is purple (#7C3AED) — not amber. This is intentional: the desktop marketing page uses purple as the conversion color while the in-app experience uses amber for daily ritual actions.

Fonts: Plus Jakarta Sans (headings), DM Sans (body), Dancing Script (italic accent word in headlines).

7.2 Sticky Navigation Bar

Minimal sticky nav, white background that fades in on scroll (with blur backdrop filter). Left: Pactara wordmark. Right: "Sign in" ghost button (purple border, purple text). No center links — the nav is intentionally minimal to keep the focus on the hero CTA.

On scroll, the nav gains a white background with 12px blur backdrop filter and a subtle bottom border.

7.3 Hero Section

Layout: Two-column, centered, wrapping flex row. Left: phone mockup. Right: copy. Gap of 64px between columns.

Phone mockup (left):

•A PhoneFrame component: 260×520px rounded rectangle with a simulated status bar, scrollable content area, and a bottom nav bar. Floats with a subtle CSS animation (animate-float-phone).

•Inside the phone: the Home Feed visual — "Good morning, Alex 👋", a purple gradient check-in CTA card, a 14-day streak card, a "Who's checked in today: 4/5" progress bar, and two feed entries (Jamie, Taylor) with reaction rows.

•Three floating notification cards positioned around the phone (left and right), each with a member avatar, name, and short message. They animate with a gentle float (floatCard keyframe, 3.5s ease-in-out).

Copy (right):

•Eyebrow: "Fitness accountability" in uppercase purple, 11px, 700 weight

•H1: "Fitness is better together." — "together." is in Dancing Script italic purple

•Subheading: "Pactara keeps you accountable with a small group of people who actually show up — every single day."

•App Store + Google Play download badges (black pill buttons with platform SVG icons)

•Fine print: "Free to start · No credit card required"

7.4 Feature Sections (Alternating Left/Right)

Four FeatureSection components stacked vertically, each with a phone mockup on one side and copy on the other. Sections alternate background color: white (#FFFFFF) and off-white (#F7F5F2). Each section fades in on scroll via IntersectionObserver.

#

Tag

Headline

Body summary

Phone visual

BG

Direction

1

Check-in

"Check in daily & build your streak."

Ten seconds. Your group sees it instantly.

Check-in flow: 3 completion options (Crushed it, Got it done, Tough day), purple selected state, "Share with group" button

White

Phone left

2

Accountability

"See your group show up."

Real accountability means real visibility.

Group feed: "Morning Warriors" header, 4-member check-in list (3 done, 1 pending "Your turn")

Off-white

Phone right

3

Streaks

"Track your progress."

Consistency is the only thing that matters.

Streak visual: 21-day counter, weekly dot grid (M–S, 6 filled + 1 dashed), best streak + monthly stats cards

White

Phone left

4

Community

"Stay accountable together."

Keep it small (2–8 people) so everyone notices.

Group list: 3 groups (Daily run, Strength training, Morning yoga) with emoji, member avatars, streak count, today's ratio

Off-white

Phone right

Each section's copy block has: a purple uppercase tag label, a large bold headline with one Dancing Script italic accent word, and a 17px body paragraph.

7.5 FAQ Section

Background: off-white (#F7F5F2). Centered, max-width 3xl. Headline: "Questions? Answered." ("Answered." in Dancing Script purple). Six accordion items, each a white rounded card with a subtle border. Clicking a question expands the answer with an animated chevron rotation.

Questions:

1.How do I find my fitness group?

2.Do I need to be at a specific fitness level?

3.What counts as a check-in?

4.What if someone stops showing up?

5.Who can see my check-ins?

6.What happens when I miss a day?

7.6 Final CTA Section

White background, centered, max-width 2xl. Eyebrow: "Start today". Headline: "Your group is waiting." Subheading: "Free to start. No credit card required. Join thousands of people who finally found the accountability they needed." App Store + Google Play badges centered. "Already have an account? Sign in →" link below.

7.7 Footer

Light grey background (#FAFAFA), top border. Single row: Pactara wordmark left, three text links center (Privacy, Terms, Support), copyright right. Minimal — no multi-column layout.

7.8 Visual Style Notes

•White background throughout — not cream. The desktop page is cleaner and more conversion-focused than the warm in-app aesthetic.

•Purple (#7C3AED) is the sole accent — buttons, labels, streak counters, italic accent words, and active states all use this purple. Amber does not appear on the desktop page.

•Phone mockups are the hero — every section is anchored by a phone frame showing real app UI. No abstract illustrations or stock photos.

•Dancing Script italic accent — exactly one word per headline is set in Dancing Script italic purple. This is the page's signature typographic move.

•Scroll fade-in — every section and FAQ item fades up on scroll via IntersectionObserver (opacity + translateY, 0.5–0.85s ease). Staggered delays on FAQ items.

•Floating notification cards — the hero phone has three floating cards positioned around it with member avatars and short messages. They animate with a 3.5s float loop, staggered by 0.6s each.

Section 8 — Subscription & Paywall Logic

The paywall is enforced at two points: the Check-In tab and the Chat tab. Free users can browse the feed, react to posts, and view group members — but they cannot post check-ins or send chat messages.

When a free user taps Check-In or Chat, the server returns a PAYMENT_REQUIRED error. The client intercepts this error globally and shows the Paywall Modal (Section 6.14). The modal offers a 7-day free trial via Stripe Checkout.

Stripe Checkout sessions are created server-side with allow_promotion_codes: true so the admin can distribute promo codes for testing. The checkout.session.completed webhook updates users.plan and users.stripeSubscriptionId. The customer.subscription.deleted webhook resets the user to the free plan.

Streak freezes are available to annual_unlimited plan users only, rate-limited to 1 per calendar week per group. The server checks streak_freezes for the current ISO week before allowing a freeze to be applied.

Section 9 — Notification System

All notifications are timezone-aware. The user's IANA timezone is captured automatically on first app open via Intl.DateTimeFormat().resolvedOptions().timeZone and stored in notification_prefs.timezone. The cron jobs iterate over users grouped by timezone and fire at the correct local time.

Push notifications use Firebase Cloud Messaging (FCM). Device tokens are stored in device_tokens and upserted on every app launch. A single user may have multiple tokens (one per device).

Email notifications use Resend. The email_log table deduplicates sends — no user receives the same notification type more than once per day per group.

Notification types and triggers:

Type

Trigger

Channel

Morning Motivation

8am local time, daily

Push + Email

Streak at Risk

8pm local time, if no check-in yet

Push

Missed Ritual Alert

12pm local time, if no standup posted

Push

Reaction Alert

Someone reacts to your post

Push

Comment Alert

Someone comments on your post

Push

Nudge

A group member nudges you

Push

New Member

Someone joins your group

Push

Weekly Recap

Sunday 6pm local time

Email

Group Streak Milestone

Group hits 7/14/30/60/90 day collective streak

Push

End of Pactara Lovable Prompt Package. Version 1.0 — June 2025.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pactara.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/37deba7f-b522-489e-ac22-b9f9015c4c0a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
