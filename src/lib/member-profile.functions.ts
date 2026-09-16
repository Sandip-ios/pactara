import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeStreaks(dates: string[], frozenDates: string[] = []) {
  const set = new Set<string>([...dates, ...frozenDates]);
  let current = 0;
  const cursor = new Date();
  if (!set.has(ymd(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (set.has(ymd(cursor))) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const sorted = [...set].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const s of sorted) {
    const d = new Date(s + "T00:00:00Z");
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = d;
  }
  return { current, best };
}

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

    // Groups the caller belongs to
    const { data: myRows } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", callerId);
    const myGroupIds = (myRows ?? []).map((r) => r.group_id as string);

    // Groups the target belongs to (restricted to shared ones when viewing someone else)
    const { data: theirRows } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", targetId);
    const theirMemberships = (theirRows ?? []).filter((r) =>
      isSelf ? true : myGroupIds.includes(r.group_id as string),
    );

    if (theirMemberships.length === 0) {
      throw new Error("You don't share a group with this member.");
    }

    const membership =
      (data.groupId
        ? theirMemberships.find((m) => m.group_id === data.groupId)
        : null) ??
      [...theirMemberships].sort(
        (a, b) =>
          new Date(b.joined_at as string).getTime() -
          new Date(a.joined_at as string).getTime(),
      )[0];

    const groupId = membership.group_id as string;
    const joinedAt = membership.joined_at as string;

    const { data: group } = await supabase
      .from("groups")
      .select("id, name, emoji, duration_days, start_date")
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
      .select("group_id, user_id, joined_at")
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
              .createSignedUrl(avatarPath, 60 * 60);
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
      .select("name, avatar_color, avatar_url, streak_freezes_available")
      .eq("id", targetId)
      .maybeSingle();

    let avatarUrl: string | null = null;
    const avatarPath = (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null;
    if (avatarPath) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(avatarPath, 60 * 60);
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

    const dates = rows.map((r) => r.checkin_date);

    const { data: freezeRows } = await supabase
      .from("streak_freezes_used")
      .select("freeze_date")
      .eq("user_id", targetId)
      .eq("group_id", groupId);
    const frozenDates = (freezeRows ?? []).map((f: { freeze_date: string }) => f.freeze_date);

    const { current, best } = computeStreaks(dates, frozenDates);

    // Media grid (newest first)
    const mediaRows = rows.filter((r) => !!r.photo_url).slice(0, 120);
    const media: ProfileMedia[] = [];
    if (mediaRows.length > 0) {
      const paths = mediaRows.map((r) => r.photo_url as string);
      const { data: signed } = await supabase.storage
        .from("chat-photos")
        .createSignedUrls(paths, 60 * 60);
      (signed ?? []).forEach((s, i) => {
        const row = mediaRows[i];
        if (!s?.signedUrl || !row) return;
        const path = row.photo_url as string;
        media.push({
          id: row.id,
          url: s.signedUrl,
          kind: /\.(mp4|mov|webm|m4v|ogg)$/i.test(path) ? "video" : "image",
          date: row.checkin_date,
        });
      });
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

    const set = new Set<string>([...dates, ...frozenDates]);
    const past7: { date: string; checked: boolean }[] = [];
    const past90: { date: string; checked: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      past7.push({ date: ymd(d), checked: set.has(ymd(d)) });
    }
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      past90.push({ date: ymd(d), checked: set.has(ymd(d)) });
    }

    const uniqueDays = new Set(dates).size;
    const joinDate = new Date(joinedAt);
    const daysSinceJoin = Math.max(
      1,
      Math.floor((Date.now() - joinDate.getTime()) / 86400000) + 1,
    );

    const now = Date.now();
    const dayMs = 86400000;
    let thisWeek = 0;
    let lastWeek = 0;
    for (const s of dates) {
      const t = new Date(s + "T00:00:00Z").getTime();
      if (t >= now - 7 * dayMs) thisWeek += 1;
      else if (t >= now - 14 * dayMs) lastWeek += 1;
    }

    const { count: missedCount } = await supabase
      .from("daily_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetId)
      .eq("group_id", groupId)
      .eq("check_in_missed", true);
    const missed = missedCount ?? 0;
    const expectedDays = Math.max(daysSinceJoin, uniqueDays + missed);
    const checkInRatePct =
      expectedDays > 0 ? Math.min(100, Math.round((uniqueDays / expectedDays) * 100)) : 0;
    const totalExpected = uniqueDays + missed;
    const onTimeRatePct =
      totalExpected > 0 ? Math.round((uniqueDays / totalExpected) * 100) : 0;

    return {
      isSelf,
      userId: targetId,
      name: profile?.name ?? "",
      avatarColor: profile?.avatar_color ?? "#7C3AED",
      avatarUrl,
      groupId,
      groupName: group?.name ?? null,
      groupEmoji: (group as { emoji?: string } | null)?.emoji ?? null,
      durationDays: (group as { duration_days?: number } | null)?.duration_days ?? null,
      startDate: (group as { start_date?: string } | null)?.start_date ?? null,
      sharedGroups: (sharedGroups ?? []).map(
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
      ),
      ),
      media,
      badges,
      totalCheckIns: dates.length,
      currentStreak: current,
      bestStreak: best,
      past7,
      past90,
      checkInRatePct,
      onTimeRatePct,
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
