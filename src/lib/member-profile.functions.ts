import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { awardBadgesForUser } from "./badges.functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isVideoPath, signFeedMedia } from "./media-urls";
import { bestStreak, currentStreak, localDateIn, pastDays, weekCounts, weeklyTarget, weeksOnGoal } from "./streak-rules";
import { profileWeek, profileNudge } from './profile-view';
import { profileStats } from './profile-tabs';

// Streaks and day grids use the member's own local dates (profiles.timezone).
export type ProfileMedia = {
  id: string;
  url: string;
  kind: "image" | "video";
  date: string;
};

/**
 * Profile for any member of a group the caller shares with them.
 * Pass no userId to get your own profile.
 */
export const getMemberProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { userId?: string | null; groupId?: string | null }) => ({
    userId: input?.userId ?? null,
    groupId: input?.groupId ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    const targetId = data.userId ?? callerId;
    const isSelf = targetId === callerId;
    const { blockedPairs } = await import('./safety.server');
    const blocked = (await blockedPairs(supabase, callerId)).has(targetId);
    const { data: ownBlock } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', callerId).eq('blocked_id', targetId).maybeSingle();

    // Groups the caller belongs to, newest membership first (matches the
    // order every other group switcher sheet uses)
    const { data: myRows } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", callerId)
      .order("joined_at", { ascending: false });
    const myOrder = (myRows ?? []).map((r) => r.group_id as string);
    const myGroupIds = myOrder;

    // Groups the target belongs to (restricted to shared ones when viewing someone else)
    const { data: theirRows } = await supabase
      .from("group_members")
      .select("group_id, joined_at, personal_goal")
      .eq("user_id", targetId);
    const theirMemberships = (theirRows ?? []).filter((r) =>
      isSelf ? true : myGroupIds.includes(r.group_id as string),
    );

    // Your own profile must still load (name, photo) when you aren't in any group yet.
    const noGroups = theirMemberships.length === 0;
    if (noGroups && !isSelf) {
      throw new Error("You don't share a group with this member.");
    }

    const membership = noGroups
      ? { group_id: "00000000-0000-0000-0000-000000000000", joined_at: new Date().toISOString(), personal_goal: null }
      : ((data.groupId
          ? theirMemberships.find((m) => m.group_id === data.groupId)
          : null) ??
        [...theirMemberships].sort(
          (a, b) =>
            new Date(b.joined_at as string).getTime() -
            new Date(a.joined_at as string).getTime(),
        )[0]);

    const groupId = membership.group_id as string;
    const joinedAt = membership.joined_at as string;
    const personalGoal = (membership.personal_goal as string | null) ?? null;

    const { data: group } = await supabase
      .from("groups")
      .select("id, name, emoji, duration_days, start_date, frequency, days_per_week, ended_at")
      .eq("id", groupId)
      .maybeSingle();

    // Shared groups list (for the switcher)
    const sharedIds = theirMemberships.map((m) => m.group_id as string);
    const { data: sharedGroups } = await supabase
      .from("groups")
      .select("id, name, emoji, duration_days, start_date, created_at")
      .in("id", sharedIds);

    const { data: sharedMemberships } = await supabase
      .from("group_members")
      .select("group_id, user_id, joined_at, personal_goal")
      .in("group_id", sharedIds)
      .order("joined_at", { ascending: true });

    const sharedMemberIds = [
      ...new Set((sharedMemberships ?? []).map((row) => row.user_id as string)),
    ];
    const { data: sharedProfiles } = sharedMemberIds.length
      ? await supabase
          .from("profiles")
          .select("id, name, avatar_color, avatar_url")
          .in("id", sharedMemberIds)
      : { data: [] };
    const sharedProfileById = new Map(
      await Promise.all(
        (sharedProfiles ?? []).map(async (memberProfile) => {
          const avatarPath = memberProfile.avatar_url as string | null;
          let memberAvatarUrl: string | null = null;
          if (avatarPath) {
            const { data: signedAvatar } = await supabase.storage
              .from("avatars")
              .createSignedUrl(avatarPath, 60 * 60, { transform: { width: 192, height: 192, resize: "cover", quality: 75 } });
            memberAvatarUrl = signedAvatar?.signedUrl ?? null;
          }
          return [
            memberProfile.id as string,
            {
              id: memberProfile.id as string,
              name: (memberProfile.name as string | null) ?? "Member",
              avatarColor: (memberProfile.avatar_color as string | null) ?? "#7C3AED",
              avatarUrl: memberAvatarUrl,
            },
          ] as const;
        }),
      ),
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_color, avatar_url, streak_freezes_available, timezone, created_at")
      .eq("id", targetId)
      .maybeSingle();
    const timezone = (profile as { timezone?: string } | null)?.timezone ?? "UTC";
    const today = localDateIn(timezone);

    let avatarUrl: string | null = null;
    const avatarPath = (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null;
    if (avatarPath) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(avatarPath, 60 * 60, { transform: { width: 720, height: 720, resize: "cover", quality: 75 } });
      avatarUrl = signed?.signedUrl ?? null;
    }

    // Check-ins in this group
    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("id, checkin_date, photo_url, created_at")
      .eq("user_id", targetId)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    const rows = (checkIns ?? []) as {
      id: string;
      checkin_date: string;
      photo_url: string | null;
      created_at: string;
    }[];

    const { data: statusRows, error: statusError } = await supabase.rpc('crew_checkin_status').select('checkin_date').eq('user_id', targetId).eq('group_id', groupId);
    if (statusError) throw new Error('Could not load member status');
    const dates = [...new Set((statusRows ?? []).map(r => r.checkin_date))];

    const { data: freezeRows } = await supabase
      .from("streak_freezes_used")
      .select("freeze_date")
      .eq("user_id", targetId)
      .eq("group_id", groupId);
    const frozenDates = (freezeRows ?? []).map((f: { freeze_date: string }) => f.freeze_date);

    const keptDays = new Set<string>([...dates, ...frozenDates]);
    const current = currentStreak(keptDays, today);
    const best = bestStreak(keptDays);

    // Media grid (newest first)
    const mediaRows = rows.filter((r) => !!r.photo_url).slice(0, 120);
    const media: ProfileMedia[] = [];
    if (mediaRows.length > 0) {
      const signedByPath = await signFeedMedia(
        supabase as unknown as SupabaseClient,
        mediaRows.map((r) => r.photo_url as string),
      );
      for (const row of mediaRows) {
        const path = row.photo_url as string;
        const url = path.startsWith("http") ? path : signedByPath.get(path);
        if (!url) continue;
        media.push({
          id: row.id,
          url,
          kind: isVideoPath(path) ? "video" : "image",
          date: row.checkin_date,
        });
      }
    }

    // Backfill any milestone already reached but never recorded (e.g. streaks
    // kept alive with a freeze).
    if (isSelf && !noGroups) {
      await awardBadgesForUser(supabase, targetId, groupId);
    }

    const { data: badgeRows } = await supabase
      .from("earned_badges")
      .select("streak_days, earned_at")
      .eq("user_id", targetId)
      .eq("group_id", groupId);
    const badges = (badgeRows ?? []).map(
      (b: { streak_days: number; earned_at: string }) => ({
        streakDays: b.streak_days,
        earnedAt: b.earned_at,
      }),
    );

    const past7 = pastDays(keptDays, today, 7);
    const past90 = pastDays(keptDays, today, 90);

    const uniqueDays = new Set(dates).size;
    const joinDate = new Date(joinedAt);
    const daysSinceJoin = Math.max(
      1,
      Math.floor((Date.now() - joinDate.getTime()) / 86400000) + 1,
    );

    // This Mon–Sun week vs. the one before, in the member's timezone.
    const { thisWeek, lastWeek } = weekCounts(dates, today);

    const { data: missedRows } = await supabase
      .rpc('crew_daily_status')
      .select("user_id, local_date")
      .eq("user_id", targetId)
      .eq("group_id", groupId)
      .eq("check_in_missed", true);
    const missed = missedRows?.length ?? 0;
    const { data: viewer } = isSelf ? { data: profile } : await supabase.from('profiles').select('timezone').eq('id', callerId).maybeSingle();
    const { data: priorNudges } = isSelf ? { data: [] } : await supabase.from('member_nudges').select('id').eq('group_id', groupId).eq('nudger_id', callerId).eq('target_id', targetId).eq('local_date', localDateIn(viewer?.timezone ?? 'UTC')).limit(1);
    const nudgeState = profileNudge({ blocked, covered: keptDays.has(today), sent: Boolean(priorNudges?.length) });

    // Completed Mon–Sun weeks since joining where check-ins met the group's
    // weekly target (member's timezone).
    const target = group ? weeklyTarget(group) : null;
    const weeklyGoal =
      target !== null && !noGroups
        ? weeksOnGoal(dates, localDateIn(timezone, new Date(joinedAt)), today, target)
        : { hit: 0, completed: 0 };

    return {
      isSelf,
      blocked,
      stats: blocked ? null : profileStats({ joinedOn: localDateIn(timezone, new Date(joinedAt)), today, checkIns: dates, covered: frozenDates, target: target ?? 0 }),
      blockedByMe: !!ownBlock,
      nudgeState,
      createdAt: profile?.created_at ?? null,
      today,
      weekDays: profileWeek({ today, checkIns: new Set(dates), covered: new Set(frozenDates), missed: new Set((missedRows ?? []).map(row => row.local_date)), workingOut: false }),
      userId: targetId,
      name: profile?.name ?? "",
      avatarColor: profile?.avatar_color ?? "#7C3AED",
      avatarUrl,
      groupId,
      crewActive: Boolean(group && group.ended_at === null),
      groupName: group?.name ?? null,
      groupEmoji: (group as { emoji?: string } | null)?.emoji ?? null,
      durationDays: (group as { duration_days?: number } | null)?.duration_days ?? null,
      startDate: (group as { start_date?: string } | null)?.start_date ?? null,
      personalGoal,
      sharedGroups: (sharedGroups ?? [])
        .map(
          (g: {
            id: string;
            name: string;
            emoji: string;
            duration_days: number | null;
            start_date: string | null;
            created_at: string | null;
          }) => {
            const groupMemberships = (sharedMemberships ?? []).filter(
              (row) => row.group_id === g.id,
            );
            return {
              id: g.id,
              name: g.name,
              emoji: g.emoji,
              durationDays: g.duration_days ?? 30,
              startDate: g.start_date,
              createdAt: g.created_at,
              memberCount: groupMemberships.length,
              members: groupMemberships
                .map((row) => sharedProfileById.get(row.user_id as string))
                .filter(
                  (member): member is NonNullable<typeof member> => Boolean(member),
                ),
            };
          },
        )
        // Keep the same order as the home / check-in / notifications sheets
        .sort(
          (a, b) =>
            myOrder.indexOf(a.id) - myOrder.indexOf(b.id),
        ),
      media,
      badges: blocked ? [] : badges,
      totalCheckIns: dates.length,
      currentStreak: current,
      bestStreak: best,
      past7,
      past90,
      weeklyTarget: target,
      weeksOnGoal: weeklyGoal,
      daysSinceJoin,
      uniqueDaysCheckedIn: uniqueDays,
      thisWeek,
      lastWeek,
      missedCount: missed,
      streakFreezesAvailable: isSelf
        ? ((profile as { streak_freezes_available?: number } | null)
            ?.streak_freezes_available ?? 0)
        : 0,
    };
  });
