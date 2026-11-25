import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateFor } from "@/lib/daily-posts.functions";
import { WORKOUT_SESSION_TTL_MS } from "@/lib/workouts.functions";
import { currentStreak, dayCovered, groupStreak as computeGroupStreak, localDateIn } from "@/lib/streak-rules";
import { memberOwnToday } from "@/lib/group-today-view";
import { alreadyNudgedResult, nudgeDecision, type NudgeResult } from "@/lib/nudge-rules";

/**
 * Daily accountability status for the Groups tab.
 *
 * The Groups tab answers one question — "did everyone show up today?" — so
 * this module returns, per group, each member's state for the current local
 * day plus the group streak (consecutive days where every member showed up).
 */

export type MemberTodayStatus =
  | "done"
  | "working_out"
  | "in_progress"
  | "committed"
  | "missed"
  | "not_committed";

export type MemberToday = {
  userId: string;
  name: string;
  firstName: string;
  avatarUrl: string | null;
  avatarColor: string;
  isYou: boolean;
  isAdmin: boolean;
  status: MemberTodayStatus;
  committedAt: string | null;
  commitmentText: string | null;
  streak: number;
  /** Set while this member has a live workout session running. */
  workoutStartedAt: string | null;
  workoutSessionId: string | null;
  /** Own today (member's timezone) covered by a rest or freeze row, with no check-in. */
  resting: boolean;
};

export type GroupToday = {
  id: string;
  name: string;
  emoji: string;
  goal: string | null;
  isAdmin: boolean;
  durationDays: number;
  frequency: "daily" | "weekly" | "specific";
  daysPerWeek: number;
  dayNumber: number;
  daysLeft: number;
  memberCount: number;
  doneCount: number;
  groupStreak: number;
  members: MemberToday[];
};

const STREAK_LOOKBACK_DAYS = 120;

function shiftIso(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

async function signAvatar(supabase: SupabaseClient, path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60, { transform: { width: 192, height: 192, resize: "cover", quality: 75 } });
  return data?.signedUrl ?? null;
}

export const getGroupsToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ groups: GroupToday[]; firstName: string }> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, timezone")
      .eq("id", userId)
      .maybeSingle();
    const tz = (profile?.timezone as string | undefined) ?? "UTC";
    const today = localDateFor(tz);
    const windowStart = shiftIso(today, -STREAK_LOOKBACK_DAYS);
    // Teammates' own today can be up to two days either side of the viewer's.
    const windowEnd = shiftIso(today, 2);
    const postsFrom = shiftIso(today, -2);
    const firstName = ((profile?.name as string) ?? "").split(" ")[0] || "there";

    const { data: myMemberships } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false });
    const groupIds = (myMemberships ?? []).map((m) => m.group_id as string);
    if (groupIds.length === 0) return { groups: [], firstName };

    const [groupsRes, membersRes] = await Promise.all([
      supabase
        .from("groups")
        .select("id, name, emoji, goal, owner_id, created_at, duration_days, start_date, frequency, days_per_week")
        .in("id", groupIds),
      supabase
        .from("group_members")
        .select("group_id, user_id, joined_at")
        .in("group_id", groupIds),
    ]);

    const allMembers = membersRes.data ?? [];
    const memberIds = Array.from(new Set(allMembers.map((m) => m.user_id as string)));
    const safeIds = memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"];

    const [profilesRes, checkinsRes, postsRes, freezesRes, workoutsRes] = await Promise.all([
      supabase.from("profiles").select("id, name, avatar_color, avatar_url, timezone").in("id", safeIds),
      supabase
        .rpc('crew_checkin_status')
        .select("group_id, user_id, checkin_date")
        .in("group_id", groupIds)
        .gte("checkin_date", windowStart)
        .lte("checkin_date", windowEnd)
        .limit(20000),
      supabase
        .rpc('crew_daily_status')
        .select("group_id, user_id, local_date, morning_ritual_text, morning_ritual_posted_at, check_in_missed, check_in_id")
        .in("group_id", groupIds)
        .gte("local_date", postsFrom)
        .lte("local_date", windowEnd),
      // Applied streak freezes count as a kept day, same as on the home screen.
      supabase
        .from("streak_freezes_used")
        .select("group_id, user_id, freeze_date")
        .in("group_id", groupIds)
        .gte("freeze_date", windowStart)
        .lte("freeze_date", windowEnd)
        .limit(20000),
      // Live "working out now" sessions — only recent ones; a session left
      // active for hours (app closed, overnight) is abandoned, not live.
      supabase
        .rpc('crew_workout_status')
        .select("id, group_id, user_id, started_at")
        .in("group_id", groupIds)
        .eq("status", "active")
        .gte("started_at", new Date(Date.now() - WORKOUT_SESSION_TTL_MS).toISOString()),
    ]);


    const profileById = new Map<string, { name: string; color: string; url: string | null; tz: string }>();
    await Promise.all(
      (profilesRes.data ?? []).map(async (p) => {
        profileById.set(p.id as string, {
          name: ((p.name as string) ?? "").trim() || "Member",
          color: (p as { avatar_color?: string | null }).avatar_color ?? "#7C3AED",
          url: await signAvatar(supabase, (p as { avatar_url?: string | null }).avatar_url ?? null),
          tz: (p as { timezone?: string | null }).timezone || "UTC",
        });
      }),
    );

    // group -> user -> set of check-in dates
    const daysByGroupUser = new Map<string, Map<string, Set<string>>>();
    // Check-ins only, and rest/freeze rows only, to tell a rest day apart.
    const checkInsByKey = new Map<string, Set<string>>();
    const coveredByKey = new Map<string, Set<string>>();
    const addTo = (map: Map<string, Set<string>>, key: string, date: string) => {
      let set = map.get(key);
      if (!set) map.set(key, (set = new Set()));
      set.add(date);
    };
    for (const row of checkinsRes.data ?? []) {
      const g = row.group_id as string;
      const u = row.user_id as string;
      if (!daysByGroupUser.has(g)) daysByGroupUser.set(g, new Map());
      const byUser = daysByGroupUser.get(g)!;
      if (!byUser.has(u)) byUser.set(u, new Set());
      byUser.get(u)!.add(row.checkin_date as string);
      addTo(checkInsByKey, `${g}:${u}`, row.checkin_date as string);
    }
    for (const row of freezesRes.data ?? []) {
      const g = row.group_id as string;
      const u = row.user_id as string;
      if (!daysByGroupUser.has(g)) daysByGroupUser.set(g, new Map());
      const byUser = daysByGroupUser.get(g)!;
      if (!byUser.has(u)) byUser.set(u, new Set());
      byUser.get(u)!.add(row.freeze_date as string);
      addTo(coveredByKey, `${g}:${u}`, row.freeze_date as string);
    }


    const postByKey = new Map<
      string,
      { ritualText: string | null; ritualAt: string | null; missed: boolean; checkInId: string | null }
    >();
    for (const row of postsRes.data ?? []) {
      // Keyed by the post's own local date; each member is read on their own today.
      postByKey.set(`${row.group_id}:${row.user_id}:${row.local_date}`, {
        ritualText: (row.morning_ritual_text as string | null) ?? null,
        ritualAt: (row.morning_ritual_posted_at as string | null) ?? null,
        missed: Boolean(row.check_in_missed),
        checkInId: (row.check_in_id as string | null) ?? null,
      });
    }

    const workoutByKey = new Map<string, { id: string; startedAt: string }>();
    for (const row of workoutsRes.data ?? []) {
      workoutByKey.set(`${row.group_id}:${row.user_id}`, {
        id: row.id as string,
        startedAt: row.started_at as string,
      });
    }

    // Each member's streak runs on their own local calendar, not the viewer's.
    const memberToday = (uid: string) => localDateIn(profileById.get(uid)?.tz ?? tz);

    const out: GroupToday[] = (groupsRes.data ?? []).map((g) => {
      const gid = g.id as string;
      const duration = (g as { duration_days?: number }).duration_days ?? 30;
      const startDate = (g as { start_date?: string | null }).start_date ?? null;
      const start = startDate ?? localDateFor(tz, new Date(g.created_at as string));

      const daysSinceStart = Math.floor(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000,
      );
      const dayNumber = Math.min(duration, Math.max(1, daysSinceStart + 1));

      const roster = allMembers
        .filter((m) => m.group_id === gid)
        .sort(
          (a, b) =>
            new Date(a.joined_at as string).getTime() - new Date(b.joined_at as string).getTime(),
        );

      const byUser = daysByGroupUser.get(gid) ?? new Map<string, Set<string>>();

      const members: MemberToday[] = roster.map((m) => {
        const uid = m.user_id as string;
        const prof = profileById.get(uid);
        const days = byUser.get(uid) ?? new Set<string>();
        const workout = workoutByKey.get(`${gid}:${uid}`);
        // Status, count and nudge come only from the member's own today.
        const ownToday = memberToday(uid);
        const post = postByKey.get(`${gid}:${uid}:${ownToday}`);
        const { status, resting } = memberOwnToday({
          ownToday,
          checkInDates: checkInsByKey.get(`${gid}:${uid}`),
          coveredDates: coveredByKey.get(`${gid}:${uid}`),
          post,
          workingOut: Boolean(workout),
        });

        const name = prof?.name ?? "Member";
        return {
          userId: uid,
          name,
          firstName: name.split(" ")[0] || name,
          avatarUrl: prof?.url ?? null,
          avatarColor: prof?.color ?? "#7C3AED",
          isYou: uid === userId,
          isAdmin: (g as { owner_id?: string }).owner_id === uid,
          status,
          committedAt: post?.ritualAt ?? null,
          commitmentText: post?.ritualText ?? null,
          streak: currentStreak(days, memberToday(uid)),
          workoutStartedAt: workout?.startedAt ?? null,
          workoutSessionId: workout?.id ?? null,
          resting,
        };
      });

      // Group streak: consecutive days (ending today or yesterday) where every
      // member who had already joined checked in or had a rest/freeze row.
      // Join dates and kept days are in each member's own timezone.
      const groupStreak = computeGroupStreak(
        roster.map((m) => {
          const uid = m.user_id as string;
          return {
            joinedOn: localDateIn(profileById.get(uid)?.tz ?? tz, new Date(m.joined_at as string)),
            kept: byUser.get(uid) ?? new Set<string>(),
          };
        }),
        today,
        STREAK_LOOKBACK_DAYS,
      );

      return {
        id: gid,
        name: g.name as string,
        emoji: (g.emoji as string) || "🔥",
        goal: (g as { goal?: string | null }).goal ?? null,
        isAdmin: (g as { owner_id?: string }).owner_id === userId,
        durationDays: duration,
        frequency: (g as { frequency?: "daily" | "weekly" | "specific" }).frequency ?? "daily",
        daysPerWeek: (g as { days_per_week?: number }).days_per_week ?? 7,
        dayNumber,
        daysLeft: Math.max(0, duration - dayNumber),
        memberCount: members.length,
        doneCount: members.filter((m) => m.status === "done").length,
        groupStreak,
        members,
      };
    });

    out.sort((a, b) => groupIds.indexOf(a.id) - groupIds.indexOf(b.id));
    return { groups: out, firstName };
  });

/**
 * Sends a friendly "we're waiting for you" push to a groupmate — at most once
 * per groupmate, per group, per local day (nudger's timezone), and never when
 * their day is already covered for that group. Returns a friendly message
 * instead of throwing in those cases.
 */
export const nudgeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; userId: string }) => {
    const groupId = String(input?.groupId ?? "").trim();
    const target = String(input?.userId ?? "").trim();
    if (!groupId || !target) throw new Error("Group and member are required");
    return { groupId, userId: target };
  })
  .handler(async ({ context, data }): Promise<NudgeResult> => {
    const { supabase, userId } = context;
    const { blockedPairs } = await import('./safety.server');
    if ((await blockedPairs(supabase, userId)).has(data.userId)) {
      const result = nudgeDecision({ firstName: '', alreadyNudgedToday: false, targetCoveredToday: false, blocked: true });
      if (result) return result;
    }

    const { data: mine } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mine) throw new Error("You are not in this group");
    if (data.userId === userId) throw new Error("You can't nudge yourself");

    const { data: theirs } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", data.groupId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!theirs) throw new Error("That member is not in this group");

    const [{ data: group }, { data: people }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", data.groupId).maybeSingle(),
      supabase.from("profiles").select("id, name, timezone").in("id", [userId, data.userId]),
    ]);
    const me = (people ?? []).find((p) => p.id === userId);
    const them = (people ?? []).find((p) => p.id === data.userId);
    const actor = ((me?.name as string) ?? "").split(" ")[0] || "Someone";
    const targetFirst = ((them?.name as string) ?? "").split(" ")[0] || "They";
    const groupName = (group?.name as string) ?? "your group";

    // Once-a-day rule uses the nudger's local date; "covered" uses the target's.
    const nudgerToday = localDateIn((me?.timezone as string | null) ?? "UTC");
    const targetToday = localDateIn((them?.timezone as string | null) ?? "UTC");

    const [{ data: prior }, { data: checkIns }, { data: covers }] = await Promise.all([
      supabase
        .from("member_nudges")
        .select("id")
        .eq("group_id", data.groupId)
        .eq("nudger_id", userId)
        .eq("target_id", data.userId)
        .eq("local_date", nudgerToday)
        .limit(1),
      supabase
        .from("check_ins")
        .select("checkin_date")
        .eq("group_id", data.groupId)
        .eq("user_id", data.userId)
        .eq("checkin_date", targetToday),
      supabase
        .from("streak_freezes_used")
        .select("freeze_date")
        .eq("group_id", data.groupId)
        .eq("user_id", data.userId)
        .eq("freeze_date", targetToday),
    ]);

    const blocked = nudgeDecision({
      firstName: targetFirst,
      alreadyNudgedToday: (prior ?? []).length > 0,
      targetCoveredToday: dayCovered(
        targetToday,
        new Set((checkIns ?? []).map((c) => c.checkin_date as string)),
        new Set((covers ?? []).map((f) => f.freeze_date as string)),
      ),
    });
    if (blocked) return blocked;

    // Record first; the unique (group, nudger, target, day) key stops double taps.
    const { error: insertError } = await supabase.from("member_nudges").insert({
      group_id: data.groupId,
      nudger_id: userId,
      target_id: data.userId,
      local_date: nudgerToday,
    });
    if (insertError) {
      if (insertError.code === "23505") return alreadyNudgedResult(targetFirst);
      throw new Error("Couldn't send that nudge");
    }

    const { notifyUsers } = await import("@/lib/notify.server");
    await notifyUsers(
      [data.userId],
      {
        title: `👋 ${actor} nudged you`,
        actorUserId: userId,
        body: `${groupName} is waiting on you today. You've got this.`,
        url: `/check-in?group=${data.groupId}`,
      },
      "nudges_enabled",
    );
    return { ok: true, message: `👋 Nudge sent to ${targetFirst}` };
  });
