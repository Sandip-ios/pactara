import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateFor } from "@/lib/daily-posts.functions";

/**
 * Daily accountability status for the Groups tab.
 *
 * The Groups tab answers one question — "did everyone show up today?" — so
 * this module returns, per group, each member's state for the current local
 * day plus the group streak (consecutive days where every member showed up).
 */

export type MemberTodayStatus = "done" | "in_progress" | "committed" | "missed" | "not_committed";

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
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
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

    const [profilesRes, checkinsRes, postsRes] = await Promise.all([
      supabase.from("profiles").select("id, name, avatar_color, avatar_url").in("id", safeIds),
      supabase
        .from("check_ins")
        .select("group_id, user_id, checkin_date")
        .in("group_id", groupIds)
        .gte("checkin_date", windowStart)
        .lte("checkin_date", today)
        .limit(20000),
      supabase
        .from("daily_posts")
        .select("group_id, user_id, morning_ritual_text, morning_ritual_posted_at, check_in_missed, check_in_id")
        .in("group_id", groupIds)
        .eq("local_date", today),
    ]);

    const profileById = new Map<string, { name: string; color: string; url: string | null }>();
    await Promise.all(
      (profilesRes.data ?? []).map(async (p) => {
        profileById.set(p.id as string, {
          name: ((p.name as string) ?? "").trim() || "Member",
          color: (p as { avatar_color?: string | null }).avatar_color ?? "#7C3AED",
          url: await signAvatar(supabase, (p as { avatar_url?: string | null }).avatar_url ?? null),
        });
      }),
    );

    // group -> user -> set of check-in dates
    const daysByGroupUser = new Map<string, Map<string, Set<string>>>();
    for (const row of checkinsRes.data ?? []) {
      const g = row.group_id as string;
      const u = row.user_id as string;
      if (!daysByGroupUser.has(g)) daysByGroupUser.set(g, new Map());
      const byUser = daysByGroupUser.get(g)!;
      if (!byUser.has(u)) byUser.set(u, new Set());
      byUser.get(u)!.add(row.checkin_date as string);
    }

    const postByKey = new Map<
      string,
      { ritualText: string | null; ritualAt: string | null; missed: boolean; checkInId: string | null }
    >();
    for (const row of postsRes.data ?? []) {
      postByKey.set(`${row.group_id}:${row.user_id}`, {
        ritualText: (row.morning_ritual_text as string | null) ?? null,
        ritualAt: (row.morning_ritual_posted_at as string | null) ?? null,
        missed: Boolean(row.check_in_missed),
        checkInId: (row.check_in_id as string | null) ?? null,
      });
    }

    const computeStreak = (days: Set<string>): number => {
      const start = days.has(today) ? today : days.has(shiftIso(today, -1)) ? shiftIso(today, -1) : null;
      if (!start) return 0;
      let streak = 0;
      let cursor = start;
      while (days.has(cursor)) {
        streak += 1;
        cursor = shiftIso(cursor, -1);
      }
      return streak;
    };

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
        const post = postByKey.get(`${gid}:${uid}`);
        const doneToday = days.has(today) || Boolean(post?.checkInId);

        let status: MemberTodayStatus = "not_committed";
        if (doneToday) status = "done";
        else if (post?.missed) status = "missed";
        else if (post?.ritualText) status = "committed";

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
          streak: computeStreak(days),
        };
      });

      // Group streak: consecutive days (ending today or yesterday) where every
      // member who had already joined checked in.
      const joinedIsoByUser = new Map(
        roster.map((m) => [m.user_id as string, localDateFor(tz, new Date(m.joined_at as string))]),
      );
      const everyoneShowedUp = (iso: string) => {
        const required = roster.filter((m) => (joinedIsoByUser.get(m.user_id as string) ?? iso) <= iso);
        if (required.length === 0) return false;
        return required.every((m) => (byUser.get(m.user_id as string) ?? new Set()).has(iso));
      };
      let groupStreak = 0;
      let cursor = everyoneShowedUp(today)
        ? today
        : everyoneShowedUp(shiftIso(today, -1))
          ? shiftIso(today, -1)
          : null;
      while (cursor && everyoneShowedUp(cursor) && groupStreak < STREAK_LOOKBACK_DAYS) {
        groupStreak += 1;
        cursor = shiftIso(cursor, -1);
      }

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

/** Sends a friendly "we're waiting for you" push to a groupmate. */
export const nudgeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; userId: string }) => {
    const groupId = String(input?.groupId ?? "").trim();
    const target = String(input?.userId ?? "").trim();
    if (!groupId || !target) throw new Error("Group and member are required");
    return { groupId, userId: target };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: mine } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mine) throw new Error("You are not in this group");
    if (data.userId === userId) return { ok: true };

    const { data: theirs } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", data.groupId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!theirs) throw new Error("That member is not in this group");

    const [{ data: group }, { data: me }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", data.groupId).maybeSingle(),
      supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
    ]);
    const actor = ((me?.name as string) ?? "").split(" ")[0] || "Someone";
    const groupName = (group?.name as string) ?? "your group";

    const { notifyUsers } = await import("@/lib/notify.server");
    await notifyUsers(
      [data.userId],
      {
        title: `👋 ${actor} nudged you`,
        body: `${groupName} is waiting on you today. You've got this.`,
        url: "/check-in",
      },
      "group_activity_enabled",
    );
    return { ok: true };
  });
