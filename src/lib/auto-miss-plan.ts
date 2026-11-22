import {
  addDaysIso,
  closeDay,
  localDateIn,
  restAllowance,
  weekEndIso,
  weekStartIso,
  type GroupSchedule,
} from "@/lib/streak-rules";

/**
 * Pure planner for the hourly auto-miss job: decides, for every membership
 * whose local "yesterday" just closed, whether that day is kept, covered by an
 * automatic rest day, or missed. The route loads all inputs in batches and
 * applies the returned writes in batches.
 */

export type PlanMembership = {
  userId: string;
  groupId: string;
  joinedAt: string;
  timezone: string;
  group: GroupSchedule;
};

export type PlanPost = { id: string; checkInId: string | null; missed: boolean };

export type AutoMissPlan = {
  /** streak_freezes_used rows to insert with kind = 'rest'. */
  rests: { user_id: string; group_id: string; freeze_date: string; kind: "rest" }[];
  /** daily_posts rows to create for the closed day. */
  postInserts: { user_id: string; group_id: string; local_date: string; check_in_missed: boolean }[];
  /** Existing daily_posts ids to flag missed. */
  missedIds: string[];
  /** Existing daily_posts ids covered by a rest day that must not show missed. */
  unmissIds: string[];
};

export const key = (userId: string, groupId: string, date?: string) =>
  date ? `${userId}|${groupId}|${date}` : `${userId}|${groupId}`;

/** The closed day ("yesterday") and its week for a member at `now`. */
export function closedDayFor(timezone: string, now: Date) {
  const day = addDaysIso(localDateIn(timezone, now), -1);
  return { day, weekStart: weekStartIso(day), weekEnd: weekEndIso(day) };
}

export function planAutoMiss(input: {
  memberships: PlanMembership[];
  now: Date;
  /** key(user, group, date) for every check-in. */
  checkIns: Set<string>;
  /** key(user, group, date) for every rest or freeze row. */
  protectedDays: Set<string>;
  /** key(user, group) → dates of kind='rest' rows. */
  restDates: Map<string, Set<string>>;
  /** key(user, group, date) → existing daily post. */
  posts: Map<string, PlanPost>;
}): AutoMissPlan {
  const plan: AutoMissPlan = { rests: [], postInserts: [], missedIds: [], unmissIds: [] };

  for (const m of input.memberships) {
    const { day, weekStart, weekEnd } = closedDayFor(m.timezone, input.now);
    const joinedOn = localDateIn(m.timezone, new Date(m.joinedAt));
    if (day < joinedOn) continue;

    const dayKey = key(m.userId, m.groupId, day);
    const post = input.posts.get(dayKey);
    const checkedIn = input.checkIns.has(dayKey) || Boolean(post?.checkInId);
    const protectedDay = input.protectedDays.has(dayKey);

    const rests = input.restDates.get(key(m.userId, m.groupId)) ?? new Set<string>();
    let used = 0;
    for (const d of rests) if (d >= weekStart && d <= weekEnd) used += 1;

    const outcome = closeDay({
      checkedIn,
      protectedDay,
      restUsedThisWeek: used,
      allowance: restAllowance(m.group),
    });

    if (outcome === "kept") {
      if (protectedDay && !checkedIn && post?.missed) plan.unmissIds.push(post.id);
      continue;
    }

    if (outcome === "rest") {
      plan.rests.push({ user_id: m.userId, group_id: m.groupId, freeze_date: day, kind: "rest" });
      // Remember it so a second pass in the same run counts it.
      rests.add(day);
      input.restDates.set(key(m.userId, m.groupId), rests);
      input.protectedDays.add(dayKey);
      if (!post) {
        // A row so the feed can show "Rested · streak kept" for the day.
        plan.postInserts.push({ user_id: m.userId, group_id: m.groupId, local_date: day, check_in_missed: false });
      } else if (post.missed) {
        plan.unmissIds.push(post.id);
      }
      continue;
    }

    // Missed: no rest days left this week.
    if (!post) {
      plan.postInserts.push({ user_id: m.userId, group_id: m.groupId, local_date: day, check_in_missed: true });
    } else if (!post.missed) {
      plan.missedIds.push(post.id);
    }
  }

  return plan;
}
