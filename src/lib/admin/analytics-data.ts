/**
 * Founder analytics data layer (demo).
 *
 * Every page reads from this module only. When real backend analytics land,
 * replace `buildAnalytics` with a server function that returns the same shape —
 * no page or component needs to change.
 */

export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  custom: "Custom",
};

export const RANGE_DAYS: Record<RangeKey, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  custom: 14,
};

export type Health = "healthy" | "watch" | "attention";

export type Metric = {
  id: string;
  label: string;
  value: number;
  format: "percent" | "number" | "currency" | "duration";
  change: number; // relative change vs previous period, in the metric's own unit
  spark: number[];
  health: Health;
  explanation: string;
  definition: MetricDefinition;
  href?: string;
};

export type MetricDefinition = {
  what: string;
  formula: string;
  why: string;
  interpret: string;
};

export type FunnelStage = {
  id: string;
  label: string;
  users: number;
};

export type CohortRow = {
  cohort: string;
  size: number;
  values: (number | null)[]; // D1, D3, D7, D14, D30
};

export type Insight = {
  tone: "good" | "bad" | "neutral";
  text: string;
};

export type Priority = {
  rank: number;
  title: string;
  impact: "High" | "Medium" | "Low";
  why: string;
  action: string;
  href: string;
};

export type Alert = {
  severity: "warning" | "positive";
  text: string;
  href: string;
};

/* ------------------------------------------------------------------ */
/* deterministic pseudo-random helpers so demo data is stable per range */
/* ------------------------------------------------------------------ */

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hash(str: string) {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
  return h;
}

function series(seed: string, points: number, base: number, drift: number, noise: number) {
  const rand = seeded(hash(seed) + 11);
  return Array.from({ length: points }, (_, i) =>
    Math.max(0, base + (drift * i) / points + (rand() - 0.5) * noise),
  );
}

/* ------------------------------------------------------------------ */

const DEFS: Record<string, MetricDefinition> = {
  activation: {
    what: "Share of new accounts that reached Pactara's core experience.",
    formula:
      "Users who created an account, joined or created a group, made a commitment and completed a proof check-in ÷ new accounts",
    why: "Activation is the single best early predictor of retention — an account that never checks in with proof never experiences accountability.",
    interpret:
      "Above 45% is strong for a social habit app. Below 30% means onboarding is losing people before the aha moment.",
  },
  d1: {
    what: "New users who came back the next day and did something accountable.",
    formula: "Activated users active on day 1 ÷ activated users",
    why: "D1 tells you whether the first session actually landed.",
    interpret: "Healthy D1 with weak D7 means the app is understood but not yet habitual.",
  },
  d7: {
    what: "Activated users who returned a week later and performed an accountability action.",
    formula: "Activated users active on day 7 ÷ activated users",
    why: "D7 is where habit formation shows up. It is the metric most correlated with paying.",
    interpret: "Compare D7 across group sizes — the gap tells you how much the social layer matters.",
  },
  d30: {
    what: "Activated users still accountable 30 days after signup.",
    formula: "Activated users active on day 30 ÷ activated users",
    why: "D30 approximates long-term value and predicts subscription renewal.",
    interpret: "Strong D7 with weak D30 usually means challenge/streak lifecycles are ending badly.",
  },
  completion: {
    what: "How often a stated commitment turns into a proof check-in.",
    formula: "Completed commitments ÷ commitments created",
    why: "Pactara's promise is follow-through. This is the promise, measured.",
    interpret: "A big gap between commitments made and completed points at reminder timing or check-in friction.",
  },
  activeGroup: {
    what: "Share of eligible groups where the social loop is actually running.",
    formula: "Groups with 2+ members performing an accountability action ÷ eligible groups",
    why: "Pactara's value depends on active social accountability rather than solo usage.",
    interpret: "Below 50% means many users are effectively using a solo habit tracker.",
  },
  groupCompletion: {
    what: "How often an entire group clears the day together.",
    formula: "Group-days where every required member completed ÷ eligible group-days",
    why: "Group-complete days are the emotional payoff that drives streaks and return visits.",
    interpret: "Rising group completion usually precedes rising D30 retention.",
  },
  nudge: {
    what: "Whether a nudge is followed by a check-in.",
    formula: "Users who received a nudge and later completed a check-in ÷ users who received a nudge",
    why: "Nudging is Pactara's core social intervention. This is the experiment.",
    interpret:
      "This is observational, not a randomised test — read it as association until nudges are randomised.",
  },
};

export type Analytics = ReturnType<typeof buildAnalytics>;

export function buildAnalytics(range: RangeKey, compare: boolean) {
  const days = RANGE_DAYS[range];
  const scale = days / 30;
  const rand = seeded(hash(range) + 3);
  const jitter = (n: number) => n * (0.94 + rand() * 0.12);

  const wau = Math.round(jitter(398));
  const accountable = Math.round(wau * 0.61);

  const mk = (
    id: string,
    label: string,
    value: number,
    format: Metric["format"],
    change: number,
    health: Health,
    explanation: string,
    href: string,
  ): Metric => ({
    id,
    label,
    value,
    format,
    change,
    spark: series(id + range, 12, value * 0.88, value * 0.2, value * 0.12),
    health,
    explanation,
    definition: DEFS[id],
    href,
  });

  const metrics: Metric[] = [
    mk("activation", "Activation Rate", 0.41, "percent", 0.03, "watch",
      "41% of new accounts made a commitment and completed a proof check-in.", "/admin/funnel"),
    mk("d1", "D1 Retention", 0.54, "percent", 0.02, "healthy",
      "54% of activated users came back the next day and did something accountable.", "/admin/retention"),
    mk("d7", "D7 Retention", 0.34, "percent", 0.05, "healthy",
      "34% of activated users returned and performed an accountability action seven days later.", "/admin/retention"),
    mk("d30", "D30 Retention", 0.19, "percent", -0.02, "watch",
      "19% are still checking in a month after signup — momentum fades around the streak reset.", "/admin/retention"),
    mk("completion", "Commitment Completion", 0.46, "percent", 0.04, "watch",
      "71% of active users commit, but only 46% of those commitments end in a check-in.", "/admin/accountability"),
    mk("activeGroup", "Active Group Rate", 0.58, "percent", 0.01, "healthy",
      "58% of eligible groups had two or more members show up in this period.", "/admin/groups"),
    mk("groupCompletion", "Group Completion Rate", 0.42, "percent", 0.06, "healthy",
      "42% of eligible group-days ended with everyone across the line.", "/admin/groups"),
    mk("nudge", "Nudge Effectiveness", 0.68, "percent", 0.09, "healthy",
      "68% of nudged members completed a check-in afterwards, vs 41% of members who weren't nudged.", "/admin/accountability"),
  ];

  const funnel: FunnelStage[] = [
    { id: "app_installed", label: "App Installed", users: Math.round(1000 * scale + 200) },
    { id: "account_created", label: "Account Created", users: Math.round(800 * scale + 160) },
    { id: "group", label: "Created or Joined Group", users: Math.round(600 * scale + 118) },
    { id: "member_joined", label: "Another Member Joined", users: Math.round(450 * scale + 88) },
    { id: "first_commitment", label: "First Commitment Created", users: Math.round(400 * scale + 78) },
    { id: "first_checkin", label: "First Check-In Completed", users: Math.round(330 * scale + 64) },
    { id: "d7", label: "Active Day 7", users: Math.round(210 * scale + 40) },
    { id: "d30", label: "Active Day 30", users: Math.round(130 * scale + 25) },
    { id: "trial", label: "Trial Started", users: Math.round(90 * scale + 18) },
    { id: "paid", label: "Paid Subscriber", users: Math.round(52 * scale + 10) },
  ];

  const cohorts: CohortRow[] = [
    { cohort: "Aug 4", size: 214, values: [0.51, 0.4, 0.3, 0.24, 0.17] },
    { cohort: "Aug 11", size: 248, values: [0.53, 0.42, 0.31, 0.25, 0.18] },
    { cohort: "Aug 18", size: 262, values: [0.56, 0.44, 0.34, 0.27, 0.19] },
    { cohort: "Aug 25", size: 301, values: [0.55, 0.43, 0.33, 0.26, null] },
    { cohort: "Sep 1", size: 336, values: [0.52, 0.39, 0.28, null, null] },
    { cohort: "Sep 8", size: 358, values: [0.57, 0.45, null, null, null] },
  ];

  const coreCohorts: CohortRow[] = cohorts.map((c) => ({
    ...c,
    values: c.values.map((v) => (v === null ? null : Math.round(v * 0.72 * 100) / 100)),
  }));

  const retentionByPartners = [
    { label: "0 active partners", d7: 0.13, d30: 0.12, users: 412 },
    { label: "1 active partner", d7: 0.29, d30: 0.28, users: 508 },
    { label: "2 active partners", d7: 0.47, d30: 0.46, users: 366 },
    { label: "3+ active partners", d7: 0.62, d30: 0.61, users: 281 },
  ];

  const dailyLoop = [
    { label: "Commit", users: 312 },
    { label: "Check group", users: 268 },
    { label: "Check in", users: 231 },
    { label: "Interact with group", users: 164 },
    { label: "Group completes day", users: 98 },
    { label: "Return tomorrow", users: 142 },
  ];

  const commitmentTrend = Array.from({ length: Math.min(days, 30) }, (_, i) => {
    const r = seeded(hash(range + i))();
    const made = Math.round(280 + i * 2 + r * 60);
    return { day: `D${i + 1}`, made, completed: Math.round(made * (0.42 + r * 0.12)) };
  });

  const groupsByHour = [
    { part: "Morning", opens: 1840 },
    { part: "Afternoon", opens: 1120 },
    { part: "Evening", opens: 2460 },
    { part: "Night", opens: 640 },
  ];

  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    opens: Math.round(
      120 +
        420 * Math.exp(-((h - 7) ** 2) / 8) +
        560 * Math.exp(-((h - 20) ** 2) / 6) +
        seeded(hash(range + "h" + h))() * 60,
    ),
  }));

  const nudgeResponse = [
    { label: "Within 15 minutes", value: 0.31 },
    { label: "Within 1 hour", value: 0.24 },
    { label: "Within 3 hours", value: 0.13 },
    { label: "Same day", value: 0.09 },
    { label: "Did not respond", value: 0.23 },
  ];

  const timeToActivation = [
    { label: "Under 10 minutes", value: 0.11 },
    { label: "Under 1 hour", value: 0.18 },
    { label: "Same day", value: 0.24 },
    { label: "1–3 days", value: 0.12 },
    { label: "Never activated", value: 0.35 },
  ];

  const groupHealth = [
    { label: "Highly Active", groups: 38, tone: "good" as const },
    { label: "Active", groups: 51, tone: "good" as const },
    { label: "At Risk", groups: 34, tone: "warn" as const },
    { label: "Inactive", groups: 29, tone: "bad" as const },
  ];

  const groupList = [
    { id: "g1", name: "5AM Run Club", size: 6, active: 5, day: 22, length: 30, streak: 9, completion: 0.71 },
    { id: "g2", name: "Lift Heavy", size: 4, active: 4, day: 14, length: 90, streak: 14, completion: 0.66 },
    { id: "g3", name: "No Zero Days", size: 8, active: 3, day: 41, length: 90, streak: 2, completion: 0.38 },
    { id: "g4", name: "Yoga Every Day", size: 3, active: 1, day: 7, length: 30, streak: 0, completion: 0.19 },
    { id: "g5", name: "Marathon Prep", size: 5, active: 4, day: 33, length: 90, streak: 6, completion: 0.58 },
    { id: "g6", name: "Morning Pages", size: 2, active: 2, day: 11, length: 30, streak: 11, completion: 0.82 },
  ];

  const revenueBySegment = [
    { label: "Activated", conversion: 0.21 },
    { label: "Not activated", conversion: 0.04 },
    { label: "In an active group", conversion: 0.26 },
    { label: "In an inactive group", conversion: 0.06 },
    { label: "D7 retained", conversion: 0.34 },
    { label: "Not D7 retained", conversion: 0.03 },
  ];

  const mrrTrend = series(range + "mrr", 12, 3100, 2400, 320).map((v, i) => ({
    month: `M${i + 1}`,
    mrr: Math.round(v),
  }));

  const working: Insight[] = [
    { tone: "good", text: "Commitment completion rose 4 points week over week." },
    { tone: "good", text: "Users in groups with 3+ active members retain 4.8x better at D30." },
    { tone: "good", text: "Members who received a nudge checked in 27 points more often than members who didn't." },
  ];

  const attention: Insight[] = [
    { tone: "bad", text: "Invite acceptance fell from 63% to 48% this period." },
    { tone: "bad", text: "25% of new accounts never create or join a group." },
    { tone: "bad", text: "D30 retention slipped 2 points, concentrated in solo users." },
  ];

  const priorities: Priority[] = [
    {
      rank: 1,
      title: "Get new users into active groups faster",
      impact: "High",
      why: `${funnel[1].users - funnel[2].users} of ${funnel[1].users} new accounts never joined a group, and users with 2+ active partners have 3.6x higher D7 retention.`,
      action: "Improve onboarding and the invite acceptance flow before spending on acquisition.",
      href: "/admin/growth",
    },
    {
      rank: 2,
      title: "Increase commitment completion",
      impact: "Medium",
      why: "71% of active users commit, but only 46% complete. The gap is largest for commitments created after 6pm.",
      action: "Investigate reminder timing, check-in friction and making nudges more visible.",
      href: "/admin/accountability",
    },
    {
      rank: 3,
      title: "Protect D30 for solo users",
      impact: "Medium",
      why: "D30 fell 2 points; almost all of the decline sits with users who have zero active partners.",
      action: "Prompt groupless users to invite or merge into an existing active group at day 5.",
      href: "/admin/retention",
    },
  ];

  const alerts: Alert[] = [
    { severity: "warning", text: "Invite acceptance dropped 15 points versus the previous period.", href: "/admin/growth" },
    { severity: "warning", text: "Check-in completion is 18% lower on app version 1.2.3 than 1.2.2.", href: "/admin/events" },
    { severity: "positive", text: "Nudge response reached its highest level this month.", href: "/admin/accountability" },
  ];

  const today = {
    activeUsers: 487,
    commitments: 312,
    completed: 231,
    completionRate: 0.74,
    activeGroups: 62,
    groupsAllIn: 28,
    nudges: 146,
    nudgeFollowThrough: 0.68,
    d7: 0.31,
    win: "Nudge response reached its highest level this month.",
    concern: "Invite acceptance fell from 63% to 48%.",
    focus: "Investigate the invite flow before increasing acquisition spend.",
  };

  return {
    range,
    compare,
    days,
    northStar: {
      value: accountable,
      change: 0.18,
      wau,
      share: accountable / wau,
      spark: series("ns" + range, 12, accountable * 0.8, accountable * 0.3, accountable * 0.12),
    },
    metrics,
    funnel,
    cohorts,
    coreCohorts,
    retentionByPartners,
    dailyLoop,
    commitmentTrend,
    groupsByHour,
    hourly,
    nudgeResponse,
    timeToActivation,
    groupHealth,
    groupList,
    revenueBySegment,
    mrrTrend,
    working,
    attention,
    priorities,
    alerts,
    today,
  };
}

/* formatting helpers ------------------------------------------------ */

export function fmt(value: number, format: Metric["format"]) {
  if (format === "percent") return `${Math.round(value * 100)}%`;
  if (format === "currency") return `$${Math.round(value).toLocaleString()}`;
  if (format === "duration") return `${value}h`;
  return Math.round(value).toLocaleString();
}

export function fmtChange(change: number, format: Metric["format"]) {
  const arrow = change >= 0 ? "↑" : "↓";
  const abs = Math.abs(change);
  const body = format === "percent" ? `${Math.round(abs * 100)} pts` : `${Math.round(abs * 100)}%`;
  return `${arrow} ${body}`;
}
