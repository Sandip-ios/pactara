import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localDateFor } from "@/lib/daily-posts.functions";
import { WORKOUT_SESSION_TTL_MS } from "@/lib/workouts.functions";
import { signAvatarThumbs, signFeedMedia, signVideoPosters, isVideoPath } from "@/lib/media-urls";
import {
  addDaysIso,
  currentStreak,
  groupStreak as computeGroupStreak,
  localDateIn,
  weekStartIso,
  weeklyTarget,
} from "@/lib/streak-rules";
import {
  activityLabel,
  crewMemberWeek,
  orderCrew,
  weekDotsLabel,
  type CrewDayState,
  type CrewTodayStatus,
} from "@/lib/crew-today";

/**
 * Everything the top of Home needs for one group, in one batched call:
 * crew bar (day n of duration, crew streak, weekly rule), Today card
 * (who's in, my check-in to share) and the "Crew today" row (each member's
 * today status and Mon–Sun week, in that member's own timezone).
 */

export type HomeCrewMember = {
  userId: string;
  name: string;
  firstName: string;
  avatarUrl: string | null;
  avatarColor: string;
  isYou: boolean;
  status: CrewTodayStatus;
  activityLabel: string | null;
  workouts: number;
  target: number;
  restDays: number;
  days: { date: string; state: CrewDayState }[];
  weekLabel: string;
  streak: number;
  nudgedToday: boolean;
};

export type HomeCrew = {
  groupId: string;
  dayNumber: number;
  durationDays: number;
  weeklyTarget: number;
  memberCount: number;
  inCount: number;
  groupStreak: number;
  myStreak: number;
  members: HomeCrewMember[];
  myCheckIn: {
    mood: string | null;
    activity: string | null;
    note: string;
    photoUrl: string | null;
  } | null;
};

const STREAK_LOOKBACK_DAYS = 120;

export const getHomeCrew = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId?: string | null }) => ({
    groupId: input?.groupId ? String(input.groupId) : null,
  }))
  .handler(async ({ context, data }): Promise<HomeCrew | null> => {
    const { supabase, userId } = context;

    let groupId = data.groupId;
    if (groupId) {
      const { data: mine } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!mine) groupId = null;
    }
    if (!groupId) {
      const { data: latest } = await supabase
        .from("group_members")
        .select("group_id, joined_at")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      groupId = (latest?.group_id as string | undefined) ?? null;
    }
    if (!groupId) return null;

    const [{ data: group }, { data: roster }, { data: me }] = await Promise.all([
      supabase
        .from("groups")
        .select("id, created_at, duration_days, start_date, frequency, days_per_week")
        .eq("id", groupId)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("user_id, joined_at")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true }),
      supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
    ]);
    if (!group) return null;

    const viewerTz = (me?.timezone as string | null) || "UTC";
    const today = localDateFor(viewerTz);
    const windowStart = addDaysIso(today, -STREAK_LOOKBACK_DAYS);
    // Members ahead of the viewer's timezone may already be on tomorrow.
    const windowEnd = addDaysIso(today, 1);
    const weekWindowStart = addDaysIso(weekStartIso(today), -1);

    const memberIds = (roster ?? []).map((m) => m.user_id as string);
    const safeIds = memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"];

    const [profilesRes, checkInsRes, freezesRes, postsRes, workoutsRes, nudgesRes] = await Promise.all([
      supabase.from("profiles").select("id, name, avatar_color, avatar_url, timezone").in("id", safeIds),
      supabase
        .from("check_ins")
        .select("user_id, checkin_date, activity, mood, note, photo_url")
        .eq("group_id", groupId)
        .gte("checkin_date", windowStart)
        .lte("checkin_date", windowEnd)
        .limit(20000),
      supabase
        .from("streak_freezes_used")
        .select("user_id, freeze_date")
        .eq("group_id", groupId)
        .gte("freeze_date", windowStart)
        .lte("freeze_date", windowEnd)
        .limit(20000),
      supabase
        .from("daily_posts")
        .select("user_id, local_date")
        .eq("group_id", groupId)
        .eq("check_in_missed", true)
        .gte("local_date", weekWindowStart)
        .lte("local_date", windowEnd),
      supabase
        .from("workout_sessions")
        .select("user_id, started_at")
        .eq("group_id", groupId)
        .eq("status", "active")
        .gte("started_at", new Date(Date.now() - WORKOUT_SESSION_TTL_MS).toISOString()),
      supabase
        .from("member_nudges")
        .select("target_id")
        .eq("group_id", groupId)
        .eq("nudger_id", userId)
        .eq("local_date", today),
    ]);

    const profiles = new Map(
      (profilesRes.data ?? []).map((p) => [
        p.id as string,
        {
          name: ((p.name as string | null) ?? "").trim() || "Member",
          color: (p.avatar_color as string | null) ?? "#7C3AED",
          avatarPath: (p.avatar_url as string | null) ?? null,
          tz: (p.timezone as string | null) || viewerTz,
        },
      ]),
    );
    const avatarUrls = await signAvatarThumbs(
      supabase,
      [...profiles.values()].map((p) => p.avatarPath),
    );

    const setFor = (map: Map<string, Set<string>>, uid: string) => {
      let s = map.get(uid);
      if (!s) map.set(uid, (s = new Set()));
      return s;
    };
    const checkIns = new Map<string, Set<string>>();
    const covered = new Map<string, Set<string>>();
    const missed = new Map<string, Set<string>>();
    const activityByDay = new Map<string, string | null>();
    for (const r of checkInsRes.data ?? []) {
      setFor(checkIns, r.user_id as string).add(r.checkin_date as string);
      activityByDay.set(`${r.user_id}:${r.checkin_date}`, (r.activity as string | null) ?? null);
    }
    for (const r of freezesRes.data ?? []) setFor(covered, r.user_id as string).add(r.freeze_date as string);
    for (const r of postsRes.data ?? []) setFor(missed, r.user_id as string).add(r.local_date as string);
    const working = new Set((workoutsRes.data ?? []).map((w) => w.user_id as string));
    const nudged = new Set((nudgesRes.data ?? []).map((n) => n.target_id as string));

    const schedule = {
      frequency: group.frequency as string | null,
      days_per_week: group.days_per_week as number | null,
    };

    const members: HomeCrewMember[] = memberIds.map((uid) => {
      const prof = profiles.get(uid);
      const memberToday = localDateIn(prof?.tz ?? viewerTz);
      const ci = checkIns.get(uid) ?? new Set<string>();
      const cov = covered.get(uid) ?? new Set<string>();
      const week = crewMemberWeek(
        {
          today: memberToday,
          checkIns: ci,
          covered: cov,
          missed: missed.get(uid) ?? new Set<string>(),
          workingOut: working.has(uid),
        },
        schedule,
      );
      const kept = new Set([...ci, ...cov]);
      const name = prof?.name ?? "Member";
      return {
        userId: uid,
        name,
        firstName: name.split(" ")[0] || name,
        avatarUrl: prof?.avatarPath ? avatarUrls.get(prof.avatarPath) ?? null : null,
        avatarColor: prof?.color ?? "#7C3AED",
        isYou: uid === userId,
        status: week.status,
        activityLabel:
          week.status === "done" ? activityLabel(activityByDay.get(`${uid}:${memberToday}`)) : null,
        workouts: week.workouts,
        target: week.target,
        restDays: week.restDays,
        days: week.days,
        weekLabel: weekDotsLabel(week.workouts, week.restDays, week.missedDays),
        streak: currentStreak(kept, memberToday),
        nudgedToday: nudged.has(uid),
      };
    });

    // Same group-streak rule as the Groups tab: every member who had joined
    // either checked in or had a rest/freeze row, in their own timezone.
    const groupStreak = computeGroupStreak(
      (roster ?? []).map((m) => {
        const uid = m.user_id as string;
        return {
          joinedOn: localDateIn(profiles.get(uid)?.tz ?? viewerTz, new Date(m.joined_at as string)),
          kept: new Set([...(checkIns.get(uid) ?? []), ...(covered.get(uid) ?? [])]),
        };
      }),
      today,
      STREAK_LOOKBACK_DAYS,
    );

    const duration = (group.duration_days as number | null) ?? 30;
    const start =
      (group.start_date as string | null) ?? localDateFor(viewerTz, new Date(group.created_at as string));
    const daysSinceStart = Math.floor(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000,
    );

    // Today's own check-in, for "Share your check-in".
    const myRow = (checkInsRes.data ?? []).find(
      (r) => r.user_id === userId && r.checkin_date === today,
    );
    let myCheckIn: HomeCrew["myCheckIn"] = null;
    if (myRow) {
      const path = (myRow.photo_url as string | null) ?? null;
      let photoUrl: string | null = null;
      if (path?.startsWith("http")) photoUrl = path;
      else if (path && isVideoPath(path)) photoUrl = (await signVideoPosters(supabase, [path])).get(path) ?? null;
      else if (path) photoUrl = (await signFeedMedia(supabase, [path])).get(path) ?? null;
      myCheckIn = {
        mood: (myRow.mood as string | null) ?? null,
        activity: (myRow.activity as string | null) ?? null,
        note: (myRow.note as string | null) ?? "",
        photoUrl,
      };
    }

    const mine = members.find((m) => m.isYou);
    return {
      groupId,
      dayNumber: Math.min(duration, Math.max(1, daysSinceStart + 1)),
      durationDays: duration,
      weeklyTarget: weeklyTarget(schedule),
      memberCount: members.length,
      inCount: members.filter((m) => m.status === "done").length,
      groupStreak,
      myStreak: mine?.streak ?? 0,
      members: orderCrew(members),
      myCheckIn,
    };
  });
