/**
 * Founder analytics types and formatting helpers.
 *
 * All values are produced by `getFounderAnalytics` in `analytics.functions.ts`
 * from the real Pactara database. Nothing here invents numbers.
 */

export type RangeKey = "today" | "7d" | "30d" | "90d" | "all";

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

export const RANGE_DAYS: Record<RangeKey, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: 3650,
};

export type Health = "healthy" | "watch" | "attention";

export type MetricDefinition = {
  what: string;
  formula: string;
  why: string;
  interpret: string;
};

export type Metric = {
  id: string;
  label: string;
  value: number;
  format: "percent" | "number" | "currency" | "duration";
  change: number;
  spark: number[];
  health: Health;
  explanation: string;
  definition: MetricDefinition;
  href?: string;
};

export type FunnelStage = { id: string; label: string; users: number; note?: string };

export type CohortRow = { cohort: string; size: number; values: (number | null)[] };

export type Insight = { tone: "good" | "bad" | "neutral"; text: string };

export type Priority = {
  rank: number;
  title: string;
  impact: "High" | "Medium" | "Low";
  why: string;
  action: string;
  href: string;
};

export type Alert = { severity: "warning" | "positive"; text: string; href: string };

export type Point = { date: string; value: number };

export type Analytics = {
  range: RangeKey;
  days: number;
  generatedAt: string;

  totals: {
    accounts: number;
    groups: number;
    checkIns: number;
    activeSubscribers: number;
  };

  today: {
    activeUsers: number;
    commitments: number;
    completed: number;
    completionRate: number;
    activeGroups: number;
    groupsAllIn: number;
    opens: number;
    newAccounts: number;
  };

  northStar: { value: number; wau: number; share: number; change: number; spark: number[] };

  metrics: Metric[];
  funnel: FunnelStage[];

  acquisition: {
    hasAppStore: boolean;
    downloads: Point[];
    signups: Point[];
    downloadsTotal: number;
    signupsTotal: number;
    downloadToSignup: number | null;
  };

  engagement: {
    hasOpenData: boolean;
    dau: Point[];
    opens: Point[];
    opensPerActiveUser: number;
    dailyActive: number;
    weeklyActive: number;
    monthlyActive: number;
    stickiness: number;
    hourly: { hour: string; opens: number }[];
  };

  cohorts: CohortRow[];
  coreCohorts: CohortRow[];
  retentionByPartners: { label: string; d7: number; d30: number; users: number }[];
  retentionSummary: { label: string; engagement: number; core: number }[];

  lifetime: {
    avgActiveDays: number;
    medianActiveDays: number;
    groupSurvival: { label: string; value: number; note: string }[];
  };

  growth: {
    creators: number;
    avgPartnersPerCreator: number;
    avgGroupSize: number;
    soloGroupShare: number;
    joinedNotCreated: number;
    inviteFunnel: { label: string; value: number; note: string }[];
  };

  accountability: {
    commitments: number;
    completed: number;
    completionRate: number;
    missedRate: number;
    perActiveUser: number;
    usersCommitting: number;
    trend: { day: string; made: number; completed: number }[];
    completionByGroupSize: { label: string; value: number }[];
    completionByStreak: { label: string; value: number }[];
    completionByWeekday: { label: string; value: number }[];
  };

  groups: {
    health: { label: string; groups: number; tone: "good" | "warn" | "bad" }[];
    list: {
      id: string;
      name: string;
      size: number;
      active: number;
      day: number;
      length: number;
      completion: number;
      signed: number;
    }[];
    activeGroupRate: number;
    groupCompletionRate: number;
  };

  revenue: {
    activeSubscribers: number;
    trials: number;
    trialShare: number;
    paying: number;
    churned: number;
    churnRate: number;
    byBehaviour: { label: string; conversion: number }[];
    trend: { month: string; subscribers: number }[];
  };

  timeToActivation: { label: string; value: number }[];

  working: Insight[];
  attention: Insight[];
  priorities: Priority[];
  alerts: Alert[];
};

export const METRIC_DEFS: Record<string, MetricDefinition> = {
  activation: {
    what: "Share of new accounts that reached Pactara's core experience.",
    formula: "New accounts that completed at least one proof check-in ÷ new accounts in the period",
    why: "Activation is the best early predictor of retention — an account that never checks in never experiences accountability.",
    interpret: "Above 45% is strong for a social habit app. Below 30% means onboarding loses people before the aha moment.",
  },
  d1: {
    what: "New users who came back the next day and did something in the app.",
    formula: "New accounts active on the day after signup ÷ new accounts",
    why: "D1 tells you whether the first session landed.",
    interpret: "Healthy D1 with weak D7 means the app is understood but not yet habitual.",
  },
  d7: {
    what: "New users still active a week later.",
    formula: "New accounts active on day 7 ÷ new accounts",
    why: "D7 is where habit formation shows up, and it correlates most with paying.",
    interpret: "Compare D7 across group sizes to see how much the social layer matters.",
  },
  d30: {
    what: "New users still active a month after signing up.",
    formula: "New accounts active on day 30 ÷ new accounts",
    why: "D30 approximates long-term value and predicts subscription renewal.",
    interpret: "Strong D7 with weak D30 usually means streak and challenge lifecycles end badly.",
  },
  completion: {
    what: "How often a stated commitment turns into a proof check-in.",
    formula: "Days with a completed check-in ÷ commitment days",
    why: "Pactara's promise is follow-through. This is the promise, measured.",
    interpret: "A large gap points at reminder timing or check-in friction.",
  },
  activeGroup: {
    what: "Share of multi-member groups where the social loop is actually running.",
    formula: "Groups with 2+ members active in the period ÷ groups with 2+ members",
    why: "Pactara's value depends on social accountability, not solo tracking.",
    interpret: "Below 50% means many people are effectively using a solo habit tracker.",
  },
  groupCompletion: {
    what: "How often a whole group clears the day together.",
    formula: "Group-days where every member with a commitment checked in ÷ group-days with commitments",
    why: "Group-complete days are the emotional payoff that drives streaks and return visits.",
    interpret: "Rising group completion usually comes before rising D30 retention.",
  },
  opens: {
    what: "How often an active person opens Pactara on a day they use it.",
    formula: "App opens ÷ daily active users, averaged across the period",
    why: "Repeat opens show the app is part of the day, not a once-a-day chore.",
    interpret: "Counting starts from the day open tracking shipped, so early history is empty.",
  },
};

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

export function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}
