import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  METRIC_DEFS,
  RANGE_DAYS,
  pct,
  type Alert,
  type Analytics,
  type CohortRow,
  type Health,
  type Insight,
  type Metric,
  type Point,
  type Priority,
  type RangeKey,
} from "./analytics-data";

/* ---------------------------------------------------------------- utils */

const DAY = 24 * 60 * 60 * 1000;

function dayKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

function dayList(from: Date, to: Date): string[] {
  const out: string[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) out.push(dayKey(new Date(t)));
  return out;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function health(value: number, good: number, watch: number): Health {
  if (value >= good) return "healthy";
  if (value >= watch) return "watch";
  return "attention";
}

/* --------------------------------------------------------------- shapes */

type Row = Record<string, unknown>;

function str(row: Row, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : "";
}
function maybeStr(row: Row, key: string): string | null {
  const v = row[key];
  return typeof v === "string" ? v : null;
}
function num(row: Row, key: string): number {
  const v = row[key];
  return typeof v === "number" ? v : 0;
}
function bool(row: Row, key: string): boolean {
  return row[key] === true;
}

/* ----------------------------------------------------------- server fn */

export const getFounderAnalytics = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string; range: RangeKey }) => input)
  .handler(async ({ data }): Promise<Analytics> => {
    const expected = process.env["FOUNDER_DASHBOARD_KEY"];
    if (!expected || !data.key || data.key !== expected) {
      throw new Error("Unauthorized");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => Promise<{ data: Row[] | null; error: unknown }>;
      };
    };

    const range = data.range;
    const days = RANGE_DAYS[range];
    const now = new Date();
    const todayKey = dayKey(now);
    const rangeStart = new Date(now.getTime() - (days - 1) * DAY);
    const rangeStartKey = dayKey(rangeStart);
    const prevStartKey = dayKey(new Date(now.getTime() - (days * 2 - 1) * DAY));
    const inRange = (key: string) => key >= rangeStartKey && key <= todayKey;
    const inPrev = (key: string) => key >= prevStartKey && key < rangeStartKey;

    const [
      profilesRes,
      membersRes,
      groupsRes,
      checkInsRes,
      postsRes,
      messagesRes,
      eventsRes,
      storeRes,
      subsRes,
      reactionsRes,
      commentsRes,
    ] = await Promise.all([
      db.from("profiles").select("id, created_at"),
      db.from("group_members").select("user_id, group_id, joined_at, personal_goal, pact_signed_at, pact_nudged_at"),
      db.from("groups").select("id, name, emoji, owner_id, created_at, duration_days, start_date"),
      db.from("check_ins").select("id, user_id, group_id, checkin_date, created_at"),
      db
        .from("daily_posts")
        .select("user_id, group_id, local_date, check_in_id, check_in_missed, created_at"),
      db.from("group_messages").select("user_id, created_at"),
      db.from("app_events").select("user_id, event, occurred_at"),
      db.from("app_store_daily").select("report_date, units"),
      db.from("subscriptions").select("user_id, is_active, period_type, created_at, expires_at, last_event_type"),
      db.from("post_reactions").select("user_id, created_at"),
      db.from("post_comments").select("user_id, created_at"),
    ]);

    const profiles = profilesRes.data ?? [];
    const members = membersRes.data ?? [];
    const groups = groupsRes.data ?? [];
    const checkIns = checkInsRes.data ?? [];
    const posts = postsRes.data ?? [];
    const messages = messagesRes.data ?? [];
    const events = eventsRes.data ?? [];
    const storeRows = storeRes.data ?? [];
    const subs = subsRes.data ?? [];
    const reactions = reactionsRes.data ?? [];
    const comments = commentsRes.data ?? [];

    /* -------------------------------------------------- activity indexes */

    // any activity (engagement) and core activity (proof check-in)
    const activity = new Map<string, Set<string>>();
    const core = new Map<string, Set<string>>();
    const add = (map: Map<string, Set<string>>, user: string, key: string) => {
      if (!user || !key) return;
      const set = map.get(user) ?? new Set<string>();
      set.add(key);
      map.set(user, set);
    };

    for (const r of checkIns) {
      const u = str(r, "user_id");
      const k = str(r, "checkin_date") || dayKey(str(r, "created_at"));
      add(activity, u, k);
      add(core, u, k);
    }
    for (const r of posts) add(activity, str(r, "user_id"), str(r, "local_date") || dayKey(str(r, "created_at")));
    for (const r of messages) add(activity, str(r, "user_id"), dayKey(str(r, "created_at")));
    for (const r of reactions) add(activity, str(r, "user_id"), dayKey(str(r, "created_at")));
    for (const r of comments) add(activity, str(r, "user_id"), dayKey(str(r, "created_at")));
    for (const r of events) add(activity, str(r, "user_id"), dayKey(str(r, "occurred_at")));

    const activeOn = (user: string, key: string) => activity.get(user)?.has(key) ?? false;
    const coreOn = (user: string, key: string) => core.get(user)?.has(key) ?? false;

    const activeUsersIn = (from: string, to: string) => {
      const set = new Set<string>();
      for (const [user, dayset] of activity) {
        for (const d of dayset) {
          if (d >= from && d <= to) {
            set.add(user);
            break;
          }
        }
      }
      return set;
    };

    /* ------------------------------------------------------- acquisition */

    const signupDay = new Map<string, string>();
    for (const p of profiles) signupDay.set(str(p, "id"), dayKey(str(p, "created_at")));

    const rangeDays = dayList(rangeStart, now);
    const signupSeries: Point[] = rangeDays.map((d) => ({
      date: d,
      value: profiles.filter((p) => dayKey(str(p, "created_at")) === d).length,
    }));

    const storeByDay = new Map<string, number>();
    for (const r of storeRows) storeByDay.set(str(r, "report_date"), num(r, "units"));
    const downloadSeries: Point[] = rangeDays.map((d) => ({ date: d, value: storeByDay.get(d) ?? 0 }));
    const downloadsTotal = downloadSeries.reduce((a, b) => a + b.value, 0);
    const signupsTotal = signupSeries.reduce((a, b) => a + b.value, 0);

    /* --------------------------------------------------------- app opens */

    const opensByDay = new Map<string, number>();
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, opens: 0 }));
    for (const e of events) {
      if (str(e, "event") !== "app_open") continue;
      const at = new Date(str(e, "occurred_at"));
      const k = dayKey(at);
      opensByDay.set(k, (opensByDay.get(k) ?? 0) + 1);
      if (inRange(k)) hourly[at.getUTCHours()].opens += 1;
    }
    const openSeries: Point[] = rangeDays.map((d) => ({ date: d, value: opensByDay.get(d) ?? 0 }));

    const dauSeries: Point[] = rangeDays.map((d) => ({
      date: d,
      value: [...activity.values()].filter((s) => s.has(d)).length,
    }));

    const opensPerActiveUser = (() => {
      const pairs = rangeDays
        .map((d, i) => ({ opens: openSeries[i].value, dau: dauSeries[i].value }))
        .filter((p) => p.dau > 0 && p.opens > 0);
      if (!pairs.length) return 0;
      return pairs.reduce((a, b) => a + b.opens / b.dau, 0) / pairs.length;
    })();

    const dailyActive = dauSeries.length ? dauSeries[dauSeries.length - 1].value : 0;
    const weeklyActive = activeUsersIn(dayKey(new Date(now.getTime() - 6 * DAY)), todayKey).size;
    const monthlyActive = activeUsersIn(dayKey(new Date(now.getTime() - 29 * DAY)), todayKey).size;

    /* ------------------------------------------------------------ groups */

    const membersByGroup = new Map<string, Row[]>();
    for (const m of members) {
      const g = str(m, "group_id");
      membersByGroup.set(g, [...(membersByGroup.get(g) ?? []), m]);
    }
    const groupsByUser = new Map<string, string[]>();
    for (const m of members) {
      const u = str(m, "user_id");
      groupsByUser.set(u, [...(groupsByUser.get(u) ?? []), str(m, "group_id")]);
    }

    const postsByGroupDay = new Map<string, Row[]>();
    for (const p of posts) {
      const k = `${str(p, "group_id")}|${str(p, "local_date")}`;
      postsByGroupDay.set(k, [...(postsByGroupDay.get(k) ?? []), p]);
    }

    const rangePosts = posts.filter((p) => inRange(str(p, "local_date")));
    const prevPosts = posts.filter((p) => inPrev(str(p, "local_date")));
    const completedOf = (rows: Row[]) => rows.filter((p) => maybeStr(p, "check_in_id") !== null).length;
    const completionRate = pct(completedOf(rangePosts), rangePosts.length);
    const prevCompletion = pct(completedOf(prevPosts), prevPosts.length);

    const multiMemberGroups = groups.filter((g) => (membersByGroup.get(str(g, "id")) ?? []).length >= 2);
    const activeGroups = multiMemberGroups.filter((g) => {
      const gm = membersByGroup.get(str(g, "id")) ?? [];
      const actives = gm.filter((m) => {
        const u = str(m, "user_id");
        return rangeDays.some((d) => activeOn(u, d));
      });
      return actives.length >= 2;
    });
    const activeGroupRate = pct(activeGroups.length, multiMemberGroups.length);

    let groupDays = 0;
    let groupDaysAllIn = 0;
    for (const [key, rows] of postsByGroupDay) {
      const day = key.split("|")[1];
      if (!inRange(day)) continue;
      groupDays += 1;
      if (rows.every((r) => maybeStr(r, "check_in_id") !== null)) groupDaysAllIn += 1;
    }
    const groupCompletionRate = pct(groupDaysAllIn, groupDays);

    /* ------------------------------------------------------- north star */

    const accountableIn = (from: string, to: string) => {
      const window = dayList(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));
      let count = 0;
      for (const [user, dayset] of core) {
        const hits = window.filter((d) => dayset.has(d)).length;
        if (hits < 3) continue;
        const partners = (groupsByUser.get(user) ?? []).some((g) => {
          const gm = membersByGroup.get(g) ?? [];
          return gm.some((m) => {
            const other = str(m, "user_id");
            return other !== user && window.some((d) => activeOn(other, d));
          });
        });
        if (partners) count += 1;
      }
      return count;
    };

    const nsWindowStart = dayKey(new Date(now.getTime() - 6 * DAY));
    const northStarValue = accountableIn(nsWindowStart, todayKey);
    const northStarPrev = accountableIn(
      dayKey(new Date(now.getTime() - 13 * DAY)),
      dayKey(new Date(now.getTime() - 7 * DAY)),
    );
    const northStarSpark = Array.from({ length: 8 }, (_, i) => {
      const end = new Date(now.getTime() - (7 - i) * DAY);
      return accountableIn(dayKey(new Date(end.getTime() - 6 * DAY)), dayKey(end));
    });

    /* -------------------------------------------------------- retention */

    const newAccounts = profiles.filter((p) => inRange(dayKey(str(p, "created_at"))));
    const prevAccounts = profiles.filter((p) => inPrev(dayKey(str(p, "created_at"))));

    const retentionFor = (rows: Row[], offset: number, map: Map<string, Set<string>>) => {
      const eligible = rows.filter((p) => {
        const created = new Date(str(p, "created_at"));
        return created.getTime() + offset * DAY <= now.getTime();
      });
      if (!eligible.length) return null;
      const kept = eligible.filter((p) => {
        const target = dayKey(new Date(new Date(str(p, "created_at")).getTime() + offset * DAY));
        return map.get(str(p, "id"))?.has(target) ?? false;
      });
      return kept.length / eligible.length;
    };

    const d1 = retentionFor(newAccounts, 1, activity) ?? 0;
    const d7 = retentionFor(newAccounts, 7, activity) ?? 0;
    const d30 = retentionFor(newAccounts, 30, activity) ?? 0;
    const prevD1 = retentionFor(prevAccounts, 1, activity) ?? 0;
    const prevD7 = retentionFor(prevAccounts, 7, activity) ?? 0;
    const prevD30 = retentionFor(prevAccounts, 30, activity) ?? 0;

    const retentionSummary = ([1, 3, 7, 14, 30] as const).map((n) => ({
      label: `D${n}`,
      engagement: retentionFor(profiles, n, activity) ?? 0,
      core: retentionFor(profiles, n, core) ?? 0,
    }));

    // weekly signup cohorts
    const weekStart = (d: Date) => {
      const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      c.setUTCDate(c.getUTCDate() - c.getUTCDay());
      return c;
    };
    const cohortMap = new Map<string, Row[]>();
    for (const p of profiles) {
      const k = dayKey(weekStart(new Date(str(p, "created_at"))));
      cohortMap.set(k, [...(cohortMap.get(k) ?? []), p]);
    }
    const buildCohorts = (map: Map<string, Set<string>>): CohortRow[] =>
      [...cohortMap.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .slice(-8)
        .map(([week, rows]) => ({
          cohort: new Date(`${week}T00:00:00Z`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }),
          size: rows.length,
          values: [1, 3, 7, 14, 30].map((n) => retentionFor(rows, n, map)),
        }));

    const cohorts = buildCohorts(activity);
    const coreCohorts = buildCohorts(core);

    // retention by number of active partners
    const partnerBucket = (user: string) => {
      const partners = new Set<string>();
      for (const g of groupsByUser.get(user) ?? []) {
        for (const m of membersByGroup.get(g) ?? []) {
          const other = str(m, "user_id");
          if (other !== user && (activity.get(other)?.size ?? 0) > 0) partners.add(other);
        }
      }
      const n = partners.size;
      if (n === 0) return 0;
      if (n === 1) return 1;
      if (n === 2) return 2;
      return 3;
    };
    const bucketLabels = ["0 active partners", "1 active partner", "2 active partners", "3+ active partners"];
    const retentionByPartners = bucketLabels.map((label, i) => {
      const rows = profiles.filter((p) => partnerBucket(str(p, "id")) === i);
      return {
        label,
        users: rows.length,
        d7: retentionFor(rows, 7, activity) ?? 0,
        d30: retentionFor(rows, 30, activity) ?? 0,
      };
    });

    /* --------------------------------------------------------- lifetime */

    const spans = profiles.map((p) => {
      const set = activity.get(str(p, "id"));
      if (!set || !set.size) return 0;
      const sorted = [...set].sort();
      const first = new Date(`${sorted[0]}T00:00:00Z`).getTime();
      const last = new Date(`${sorted[sorted.length - 1]}T00:00:00Z`).getTime();
      return Math.round((last - first) / DAY) + 1;
    });
    const activeSpans = spans.filter((s) => s > 0);

    const groupSurvival = [7, 14, 30].map((n) => {
      const eligible = groups.filter(
        (g) => new Date(str(g, "created_at")).getTime() + n * DAY <= now.getTime(),
      );
      const alive = eligible.filter((g) => {
        const gm = membersByGroup.get(str(g, "id")) ?? [];
        const from = new Date(new Date(str(g, "created_at")).getTime() + (n - 3) * DAY);
        const window = dayList(from, new Date(new Date(str(g, "created_at")).getTime() + (n + 3) * DAY));
        return gm.some((m) => window.some((d) => coreOn(str(m, "user_id"), d)));
      });
      return {
        label: `Still checking in at day ${n}`,
        value: pct(alive.length, eligible.length),
        note: `${alive.length} of ${eligible.length} groups`,
      };
    });

    /* ----------------------------------------------------------- growth */

    const creators = new Set(groups.map((g) => str(g, "owner_id")));
    const partnersPerCreator = [...creators].map((owner) => {
      const owned = groups.filter((g) => str(g, "owner_id") === owner);
      return owned.reduce(
        (acc, g) => acc + Math.max(0, (membersByGroup.get(str(g, "id")) ?? []).length - 1),
        0,
      );
    });
    const avgPartnersPerCreator = partnersPerCreator.length
      ? partnersPerCreator.reduce((a, b) => a + b, 0) / partnersPerCreator.length
      : 0;
    const groupSizes = groups.map((g) => (membersByGroup.get(str(g, "id")) ?? []).length);
    const avgGroupSize = groupSizes.length ? groupSizes.reduce((a, b) => a + b, 0) / groupSizes.length : 0;
    const soloGroupShare = pct(groupSizes.filter((s) => s <= 1).length, groupSizes.length);
    const joinedNotCreated = members.filter((m) => {
      const g = groups.find((x) => str(x, "id") === str(m, "group_id"));
      return g && str(g, "owner_id") !== str(m, "user_id");
    }).length;

    const withGoal = members.filter((m) => (maybeStr(m, "personal_goal") ?? "").trim().length > 0);
    const signed = members.filter((m) => maybeStr(m, "pact_signed_at") !== null);

    const inviteFunnel = [
      { label: "Groups created", value: groups.length, note: `${creators.size} creators` },
      { label: "Groups with a second member", value: multiMemberGroups.length, note: `${Math.round(pct(multiMemberGroups.length, groups.length) * 100)}% of groups` },
      { label: "Members who joined someone else's group", value: joinedNotCreated, note: "accepted invites" },
      {
        label: "Joiners who completed a check-in",
        value: members.filter((m) => {
          const g = groups.find((x) => str(x, "id") === str(m, "group_id"));
          return g && str(g, "owner_id") !== str(m, "user_id") && (core.get(str(m, "user_id"))?.size ?? 0) > 0;
        }).length,
        note: "invite converted into real use",
      },
    ];

    /* --------------------------------------------------- accountability */

    const usersCommitting = new Set(rangePosts.map((p) => str(p, "user_id"))).size;
    const activeInRange = activeUsersIn(rangeStartKey, todayKey);
    const trendDays = rangeDays.slice(-30);
    const trend = trendDays.map((d) => {
      const made = posts.filter((p) => str(p, "local_date") === d);
      return {
        day: d.slice(5),
        made: made.length,
        completed: made.filter((p) => maybeStr(p, "check_in_id") !== null).length,
      };
    });

    const completionByGroupSize = [
      { label: "Solo", test: (n: number) => n <= 1 },
      { label: "2 members", test: (n: number) => n === 2 },
      { label: "3–4 members", test: (n: number) => n >= 3 && n <= 4 },
      { label: "5+ members", test: (n: number) => n >= 5 },
    ].map(({ label, test }) => {
      const rows = rangePosts.filter((p) =>
        test((membersByGroup.get(str(p, "group_id")) ?? []).length),
      );
      return { label, value: pct(completedOf(rows), rows.length) };
    });

    const streakLength = (user: string) => {
      const set = core.get(user);
      if (!set) return 0;
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const k = dayKey(new Date(now.getTime() - i * DAY));
        if (set.has(k)) n += 1;
        else if (i > 0) break;
      }
      return n;
    };
    const completionByStreak = [
      { label: "No streak", test: (n: number) => n === 0 },
      { label: "1–3 days", test: (n: number) => n >= 1 && n <= 3 },
      { label: "4–7 days", test: (n: number) => n >= 4 && n <= 7 },
      { label: "8+ days", test: (n: number) => n >= 8 },
    ].map(({ label, test }) => {
      const rows = rangePosts.filter((p) => test(streakLength(str(p, "user_id"))));
      return { label, value: pct(completedOf(rows), rows.length) };
    });

    const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const completionByWeekday = WEEKDAYS.map((label, i) => {
      const rows = rangePosts.filter((p) => new Date(`${str(p, "local_date")}T00:00:00Z`).getUTCDay() === i);
      return { label, value: pct(completedOf(rows), rows.length) };
    });

    /* ------------------------------------------------------- group list */

    const groupList = groups
      .map((g) => {
        const id = str(g, "id");
        const gm = membersByGroup.get(id) ?? [];
        const active = gm.filter((m) => rangeDays.some((d) => activeOn(str(m, "user_id"), d))).length;
        const start = new Date(`${str(g, "start_date") || dayKey(str(g, "created_at"))}T00:00:00Z`);
        const day = Math.max(1, Math.round((now.getTime() - start.getTime()) / DAY) + 1);
        const gPosts = rangePosts.filter((p) => str(p, "group_id") === id);
        return {
          id,
          name: `${str(g, "emoji")} ${str(g, "name")}`.trim(),
          size: gm.length,
          active,
          day,
          length: num(g, "duration_days"),
          completion: pct(completedOf(gPosts), gPosts.length),
          signed: gm.filter((m) => maybeStr(m, "pact_signed_at") !== null).length,
        };
      })
      .sort((a, b) => b.active - a.active || b.size - a.size);

    const groupHealth = [
      {
        label: "Highly active",
        groups: groupList.filter((g) => g.active >= 2 && g.completion >= 0.6).length,
        tone: "good" as const,
      },
      {
        label: "Active",
        groups: groupList.filter((g) => g.active >= 2 && g.completion < 0.6).length,
        tone: "good" as const,
      },
      {
        label: "At risk",
        groups: groupList.filter((g) => g.active === 1).length,
        tone: "warn" as const,
      },
      {
        label: "Inactive",
        groups: groupList.filter((g) => g.active === 0).length,
        tone: "bad" as const,
      },
    ];

    /* ---------------------------------------------------------- revenue */

    const activeSubscribers = subs.filter((s) => bool(s, "is_active")).length;
    const trials = subs.filter((s) => bool(s, "is_active") && str(s, "period_type").toLowerCase().includes("trial")).length;
    const paying = activeSubscribers - trials;
    const churned = subs.filter((s) => !bool(s, "is_active")).length;
    const churnRate = pct(churned, subs.length);

    const converted = (userIds: Set<string>) => {
      const subscribed = new Set(subs.filter((s) => bool(s, "is_active")).map((s) => str(s, "user_id")));
      let hit = 0;
      for (const u of userIds) if (subscribed.has(u)) hit += 1;
      return pct(hit, userIds.size);
    };
    const activatedUsers = new Set([...core.keys()]);
    const notActivated = new Set(profiles.map((p) => str(p, "id")).filter((id) => !activatedUsers.has(id)));
    const inActiveGroup = new Set<string>();
    for (const g of activeGroups) {
      for (const m of membersByGroup.get(str(g, "id")) ?? []) inActiveGroup.add(str(m, "user_id"));
    }
    const revenueByBehaviour = [
      { label: "Completed a check-in", conversion: converted(activatedUsers) },
      { label: "Never checked in", conversion: converted(notActivated) },
      { label: "In an active group", conversion: converted(inActiveGroup) },
      {
        label: "Solo or inactive group",
        conversion: converted(
          new Set(profiles.map((p) => str(p, "id")).filter((id) => !inActiveGroup.has(id))),
        ),
      },
    ];

    const subTrend = Array.from({ length: 6 }, (_, i) => {
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i) + 1, 1));
      const label = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1)).toLocaleDateString(
        "en-US",
        { month: "short", timeZone: "UTC" },
      );
      const count = subs.filter((s) => new Date(str(s, "created_at")).getTime() < end.getTime()).length;
      return { month: label, subscribers: count };
    });

    /* ----------------------------------------------- time to activation */

    const firstCore = (user: string) => {
      const set = core.get(user);
      if (!set || !set.size) return null;
      return [...set].sort()[0];
    };
    const activationBuckets = [
      { label: "Same day", max: 0 },
      { label: "Within 1 day", max: 1 },
      { label: "2–3 days", max: 3 },
      { label: "4–7 days", max: 7 },
    ];
    const timeToActivation = (() => {
      const total = profiles.length || 1;
      const counts = activationBuckets.map(() => 0);
      let never = 0;
      for (const p of profiles) {
        const id = str(p, "id");
        const first = firstCore(id);
        if (!first) {
          never += 1;
          continue;
        }
        const diff = Math.round(
          (new Date(`${first}T00:00:00Z`).getTime() -
            new Date(`${dayKey(str(p, "created_at"))}T00:00:00Z`).getTime()) /
            DAY,
        );
        const idx = activationBuckets.findIndex((b) => diff <= b.max);
        if (idx >= 0) counts[idx] += 1;
        else never += 1;
      }
      return [
        ...activationBuckets.map((b, i) => ({ label: b.label, value: counts[i] / total })),
        { label: "Never checked in", value: never / total },
      ];
    })();

    /* ----------------------------------------------------------- funnel */

    const accountsAll = profiles.length;
    const inAGroup = new Set(members.map((m) => str(m, "user_id"))).size;
    const withPartner = new Set(
      members
        .filter((m) => (membersByGroup.get(str(m, "group_id")) ?? []).length >= 2)
        .map((m) => str(m, "user_id")),
    ).size;
    const goalUsers = new Set(withGoal.map((m) => str(m, "user_id"))).size;
    const signedUsers = new Set(signed.map((m) => str(m, "user_id"))).size;
    const firstCheckIn = new Set(checkIns.map((c) => str(c, "user_id"))).size;
    const repeatCheckIn = [...core.entries()].filter(([, set]) => set.size >= 2).length;
    const subscribers = new Set(subs.filter((s) => bool(s, "is_active")).map((s) => str(s, "user_id"))).size;
    const totalDownloads = storeRows.reduce((a, b) => a + num(b, "units"), 0);

    const funnel = [
      ...(totalDownloads > 0
        ? [{ id: "download", label: "App downloaded", users: totalDownloads, note: "App Store" }]
        : []),
      { id: "account", label: "Account created", users: accountsAll },
      { id: "group", label: "In a group", users: inAGroup },
      { id: "partner", label: "Group has another member", users: withPartner },
      { id: "goal", label: "Personal goal set", users: goalUsers },
      { id: "pact", label: "Pact signed", users: signedUsers },
      { id: "checkin", label: "First check-in", users: firstCheckIn },
      { id: "repeat", label: "Checked in twice", users: repeatCheckIn },
      { id: "paid", label: "Active subscriber", users: subscribers },
    ];

    /* ---------------------------------------------------------- metrics */

    const activation = pct(
      newAccounts.filter((p) => (core.get(str(p, "id"))?.size ?? 0) > 0).length,
      newAccounts.length,
    );
    const prevActivation = pct(
      prevAccounts.filter((p) => (core.get(str(p, "id"))?.size ?? 0) > 0).length,
      prevAccounts.length,
    );

    const sparkFrom = (points: Point[]) => points.slice(-12).map((p) => p.value);

    const mk = (
      id: string,
      label: string,
      value: number,
      format: Metric["format"],
      change: number,
      h: Health,
      explanation: string,
      href: string,
      spark: number[],
    ): Metric => ({
      id,
      label,
      value,
      format,
      change,
      spark: spark.length ? spark : [0, 0],
      health: h,
      explanation,
      definition: METRIC_DEFS[id],
      href,
    });

    const metrics: Metric[] = [
      mk("activation", "Activation rate", activation, "percent", activation - prevActivation,
        health(activation, 0.45, 0.3),
        `${Math.round(activation * 100)}% of new accounts completed at least one proof check-in.`,
        "/admin/funnel", sparkFrom(dauSeries)),
      mk("d1", "D1 retention", d1, "percent", d1 - prevD1, health(d1, 0.45, 0.3),
        `${Math.round(d1 * 100)}% of new accounts came back the next day.`, "/admin/retention", sparkFrom(dauSeries)),
      mk("d7", "D7 retention", d7, "percent", d7 - prevD7, health(d7, 0.3, 0.18),
        `${Math.round(d7 * 100)}% were still active a week after signing up.`, "/admin/retention", sparkFrom(dauSeries)),
      mk("d30", "D30 retention", d30, "percent", d30 - prevD30, health(d30, 0.2, 0.1),
        `${Math.round(d30 * 100)}% were still active a month after signing up.`, "/admin/retention", sparkFrom(dauSeries)),
      mk("completion", "Commitment completion", completionRate, "percent", completionRate - prevCompletion,
        health(completionRate, 0.6, 0.4),
        `${completedOf(rangePosts)} of ${rangePosts.length} commitment days ended in a proof check-in.`,
        "/admin/accountability", trend.map((t) => t.completed)),
      mk("activeGroup", "Active group rate", activeGroupRate, "percent", 0, health(activeGroupRate, 0.6, 0.4),
        `${activeGroups.length} of ${multiMemberGroups.length} multi-member groups had two or more people show up.`,
        "/admin/groups", sparkFrom(dauSeries)),
      mk("groupCompletion", "Group completion rate", groupCompletionRate, "percent", 0,
        health(groupCompletionRate, 0.5, 0.3),
        `${groupDaysAllIn} of ${groupDays} group-days ended with everyone across the line.`, "/admin/groups",
        trend.map((t) => t.completed)),
      mk("opens", "Opens per active user", opensPerActiveUser, "number", 0,
        health(opensPerActiveUser, 3, 1.5),
        opensPerActiveUser > 0
          ? `Active people open Pactara ${opensPerActiveUser.toFixed(1)} times on a day they use it.`
          : "App-open tracking has just started collecting; numbers appear from tomorrow.",
        "/admin/events", sparkFrom(openSeries)),
    ];

    /* ------------------------------------------------- insights & today */

    const working: Insight[] = [];
    const attention: Insight[] = [];
    const alerts: Alert[] = [];

    if (completionRate >= 0.6)
      working.push({ tone: "good", text: `${Math.round(completionRate * 100)}% of commitments end in a proof check-in.` });
    else
      attention.push({ tone: "bad", text: `Only ${Math.round(completionRate * 100)}% of commitments end in a proof check-in.` });

    const p0 = retentionByPartners[0].d30;
    const p3 = retentionByPartners[3].d30;
    if (p3 > p0 && p0 >= 0)
      working.push({
        tone: "good",
        text: `Members with 3+ active partners retain at ${Math.round(p3 * 100)}% at D30 versus ${Math.round(p0 * 100)}% with none.`,
      });

    if (soloGroupShare > 0.2)
      attention.push({
        tone: "bad",
        text: `${Math.round(soloGroupShare * 100)}% of groups still have only one member.`,
      });
    if (activation < 0.5)
      attention.push({
        tone: "bad",
        text: `${Math.round((1 - activation) * 100)}% of new accounts never complete a proof check-in.`,
      });
    if (activeGroupRate >= 0.6)
      working.push({ tone: "good", text: `${Math.round(activeGroupRate * 100)}% of multi-member groups are live.` });

    if (completionRate < prevCompletion - 0.05)
      alerts.push({
        severity: "warning",
        text: `Commitment completion fell ${Math.round((prevCompletion - completionRate) * 100)} points versus the previous period.`,
        href: "/admin/accountability",
      });
    if (d7 > prevD7 + 0.05)
      alerts.push({ severity: "positive", text: "D7 retention improved versus the previous period.", href: "/admin/retention" });
    if (signedUsers < inAGroup)
      alerts.push({
        severity: "warning",
        text: `${inAGroup - signedUsers} members are in a group but have not signed the pact.`,
        href: "/admin/funnel",
      });
    if (!openSeries.some((p) => p.value > 0))
      alerts.push({
        severity: "warning",
        text: "App-open tracking has no data yet — numbers start accumulating from the first app launch after this shipped.",
        href: "/admin/events",
      });
    if (totalDownloads === 0)
      alerts.push({
        severity: "warning",
        text: "App Store downloads are not connected yet, so the funnel starts at account creation.",
        href: "/admin/settings",
      });

    const priorities: Priority[] = [];
    if (inAGroup > withPartner)
      priorities.push({
        rank: priorities.length + 1,
        title: "Get a second person into every group",
        impact: "High",
        why: `${inAGroup - withPartner} members are alone in their group, and members with active partners retain far better.`,
        action: "Push invites and QR sharing harder right after group creation.",
        href: "/admin/growth",
      });
    if (completionRate < 0.7)
      priorities.push({
        rank: priorities.length + 1,
        title: "Close the commitment to check-in gap",
        impact: "High",
        why: `${rangePosts.length - completedOf(rangePosts)} commitment days in this period ended without proof.`,
        action: "Look at reminder timing and how quickly the camera opens.",
        href: "/admin/accountability",
      });
    if (activation < 0.6)
      priorities.push({
        rank: priorities.length + 1,
        title: "Fix the first check-in",
        impact: "Medium",
        why: `${Math.round((1 - activation) * 100)}% of new accounts never complete one.`,
        action: "Shorten the path from signup to the first proof video.",
        href: "/admin/funnel",
      });

    const yesterdayKey = dayKey(new Date(now.getTime() - DAY));
    const yPosts = posts.filter((p) => str(p, "local_date") === yesterdayKey);
    const yGroups = new Set(yPosts.map((p) => str(p, "group_id")));
    let yAllIn = 0;
    for (const g of yGroups) {
      const rows = postsByGroupDay.get(`${g}|${yesterdayKey}`) ?? [];
      if (rows.length && rows.every((r) => maybeStr(r, "check_in_id") !== null)) yAllIn += 1;
    }

    return {
      range,
      days,
      generatedAt: now.toISOString(),
      totals: {
        accounts: accountsAll,
        groups: groups.length,
        checkIns: checkIns.length,
        activeSubscribers,
      },
      today: {
        activeUsers: [...activity.values()].filter((s) => s.has(yesterdayKey)).length,
        commitments: yPosts.length,
        completed: completedOf(yPosts),
        completionRate: pct(completedOf(yPosts), yPosts.length),
        activeGroups: yGroups.size,
        groupsAllIn: yAllIn,
        opens: opensByDay.get(yesterdayKey) ?? 0,
        newAccounts: profiles.filter((p) => dayKey(str(p, "created_at")) === yesterdayKey).length,
      },
      northStar: {
        value: northStarValue,
        wau: weeklyActive,
        share: pct(northStarValue, weeklyActive),
        change: northStarPrev ? (northStarValue - northStarPrev) / northStarPrev : 0,
        spark: northStarSpark,
      },
      metrics,
      funnel,
      acquisition: {
        hasAppStore: totalDownloads > 0,
        downloads: downloadSeries,
        signups: signupSeries,
        downloadsTotal,
        signupsTotal,
        downloadToSignup: downloadsTotal > 0 ? signupsTotal / downloadsTotal : null,
      },
      engagement: {
        hasOpenData: events.length > 0,
        dau: dauSeries,
        opens: openSeries,
        opensPerActiveUser,
        dailyActive,
        weeklyActive,
        monthlyActive,
        stickiness: pct(dailyActive, monthlyActive),
        hourly,
      },
      cohorts,
      coreCohorts,
      retentionByPartners,
      retentionSummary,
      lifetime: {
        avgActiveDays: activeSpans.length ? activeSpans.reduce((a, b) => a + b, 0) / activeSpans.length : 0,
        medianActiveDays: median(activeSpans),
        groupSurvival,
      },
      growth: {
        creators: creators.size,
        avgPartnersPerCreator,
        avgGroupSize,
        soloGroupShare,
        joinedNotCreated,
        inviteFunnel,
      },
      accountability: {
        commitments: rangePosts.length,
        completed: completedOf(rangePosts),
        completionRate,
        missedRate: 1 - completionRate,
        perActiveUser: pct(rangePosts.length, activeInRange.size),
        usersCommitting,
        trend,
        completionByGroupSize,
        completionByStreak,
        completionByWeekday,
      },
      groups: {
        health: groupHealth,
        list: groupList,
        activeGroupRate,
        groupCompletionRate,
      },
      revenue: {
        activeSubscribers,
        trials,
        trialShare: pct(trials, subs.length),
        paying,
        churned,
        churnRate,
        byBehaviour: revenueByBehaviour,
        trend: subTrend,
      },
      timeToActivation,
      working,
      attention,
      priorities,
      alerts,
    };
  });

/** Records an app open. Fire-and-forget from the client. */
export const recordAppOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { platform?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("app_events")
      .insert({ user_id: userId, event: "app_open", platform: data.platform ?? "web" } as never);
    return { ok: true };
  });
