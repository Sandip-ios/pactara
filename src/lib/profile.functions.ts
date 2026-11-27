import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bestStreak, currentStreak, localDateIn, pastDays, weekCounts, weeklyTarget, weeksOnGoal } from "@/lib/streak-rules";

// Streaks and day grids use the member's own local dates (profiles.timezone),
// never UTC dates — otherwise a US evening already reads as "tomorrow".
export const getProfileOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null }) => ({
    groupId: input?.groupId ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const selectedGroupId = data.groupId;

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_color, avatar_url, timezone")
      .eq("id", userId)
      .maybeSingle();
    const timezone = (profile as { timezone?: string } | null)?.timezone ?? "UTC";
    const today = localDateIn(timezone);

    let avatarSignedUrl: string | null = null;
    const avatarPath = (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null;
    if (avatarPath) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(avatarPath, 60 * 60, { transform: { width: 720, height: 720, resize: "cover", quality: 75 } });
      avatarSignedUrl = signed?.signedUrl ?? null;
    }

    // All memberships for this user
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true });

    const allMemberships = memberships ?? [];
    // Pick the target membership: requested group, else most recent join
    const targetMembership =
      (selectedGroupId
        ? allMemberships.find((m) => m.group_id === selectedGroupId)
        : null) ??
      [...allMemberships].sort(
        (a, b) =>
          new Date(b.joined_at as string).getTime() -
          new Date(a.joined_at as string).getTime(),
      )[0] ??
      null;

    let groupName: string | null = null;
    let activeGroupId: string | null = null;
    let target: number | null = null;
    if (targetMembership) {
      activeGroupId = targetMembership.group_id as string;
      const { data: g } = await supabase
        .from("groups")
        .select("name, frequency, days_per_week")
        .eq("id", activeGroupId)
        .maybeSingle();
      groupName = g?.name ?? null;
      if (g) target = weeklyTarget(g);
    }

    // Days active is measured against the selected group's join date
    const joinedAt = (targetMembership as { joined_at?: string } | null)?.joined_at;

    // Group-scoped check-ins
    let checkInQuery = supabase
      .from("check_ins")
      .select("checkin_date")
      .eq("user_id", userId);
    if (activeGroupId) checkInQuery = checkInQuery.eq("group_id", activeGroupId);
    const { data: checkIns } = await checkInQuery;

    // Group-scoped applied streak freezes
    let freezeQuery = supabase
      .from("streak_freezes_used")
      .select("freeze_date")
      .eq("user_id", userId);
    if (activeGroupId) freezeQuery = freezeQuery.eq("group_id", activeGroupId);
    const { data: freezeRows } = await freezeQuery;
    const frozenDates = (freezeRows ?? []).map(
      (f: { freeze_date: string }) => f.freeze_date,
    );

    // Freezes available on profile (global to user)
    const { data: freezeProfile } = await supabase
      .from("profiles")
      .select("streak_freezes_available")
      .eq("id", userId)
      .maybeSingle();
    const streakFreezesAvailable =
      (freezeProfile as { streak_freezes_available?: number } | null)
        ?.streak_freezes_available ?? 0;

    // Distinct days: later same-day check-ins never add to the total.
    const dates = [...new Set((checkIns ?? []).map((c: { checkin_date: string }) => c.checkin_date))];
    const set = new Set<string>([...dates, ...frozenDates]);
    const current = currentStreak(set, today);
    const best = bestStreak(set);
    const past7 = pastDays(set, today, 7);
    const past90 = pastDays(set, today, 90);

    const uniqueDays = new Set(dates).size;
    let daysSinceJoin = 1;
    if (joinedAt) {
      const joinDate = new Date(joinedAt);
      const diffMs = Date.now() - joinDate.getTime();
      daysSinceJoin = Math.max(1, Math.floor(diffMs / 86400000) + 1);
    }

    // This Mon–Sun week vs. the one before, in the member's timezone.
    const { thisWeek, lastWeek } = weekCounts(dates, today);

    // Completed Mon–Sun weeks since joining where check-ins met the group's
    // weekly target (member's timezone).
    const weeklyGoal =
      target !== null && joinedAt
        ? weeksOnGoal(dates, localDateIn(timezone, new Date(joinedAt)), today, target)
        : { hit: 0, completed: 0 };

    return {
      name: profile?.name ?? "",
      avatarColor: profile?.avatar_color ?? "#7C3AED",
      avatarUrl: avatarSignedUrl,
      groupName,
      activeGroupId,
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
      streakFreezesAvailable,
      frozenDates,
    };
  });



export const setAvatarPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: data.path } as never)
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const getAccountSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    return {
      name: profile?.name ?? "",
      email: (claims as { email?: string } | null)?.email ?? "",
    };
  });

export const updateProfileName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => {
    const name = String(input?.name ?? "").trim();
    if (name.length === 0) throw new Error("Name can't be empty");
    if (name.length > 80) throw new Error("Name must be 80 characters or fewer");
    return { name };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ name: data.name })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    await (supabaseAdmin as any).from("account_deletions").upsert({
      user_id: userId,
      email: u?.user?.email ?? null,
      source: "in_app",
      deleted_at: new Date().toISOString(),
    });
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type NotificationPrefs = {
  push_enabled: boolean;
  email_enabled: boolean;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string; // "HH:MM"
  group_activity_enabled: boolean;
  morning_ritual_reminder_enabled: boolean;
  workout_start_enabled: boolean;
  workout_complete_enabled: boolean;
  nudges_enabled: boolean;
  group_milestones_enabled: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  email_enabled: true,
  daily_reminder_enabled: true,
  daily_reminder_time: "09:00",
  group_activity_enabled: true,
  morning_ritual_reminder_enabled: true,
  workout_start_enabled: true,
  workout_complete_enabled: false,
  nudges_enabled: true,
  group_milestones_enabled: true,
};

const PREF_COLUMNS =
  "push_enabled, email_enabled, daily_reminder_enabled, daily_reminder_time, group_activity_enabled, morning_ritual_reminder_enabled, workout_start_enabled, workout_complete_enabled, nudges_enabled, group_milestones_enabled";

const BOOLEAN_PREFS = [
  "push_enabled",
  "email_enabled",
  "daily_reminder_enabled",
  "group_activity_enabled",
  "morning_ritual_reminder_enabled",
  "workout_start_enabled",
  "workout_complete_enabled",
  "nudges_enabled",
  "group_milestones_enabled",
] as const;

export const getNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPrefs> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notification_preferences")
      .select(PREF_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = (data ?? {}) as Partial<NotificationPrefs>;
    const out = { ...DEFAULT_PREFS };
    for (const key of BOOLEAN_PREFS) {
      if (typeof row[key] === "boolean") out[key] = row[key] as boolean;
    }
    if (row.daily_reminder_time) {
      out.daily_reminder_time = String(row.daily_reminder_time).slice(0, 5);
    }
    return out;
  });

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<NotificationPrefs>) => {
    const out: Partial<NotificationPrefs> = {};
    for (const key of BOOLEAN_PREFS) {
      if (typeof input[key] === "boolean") out[key] = input[key] as boolean;
    }
    if (typeof input.daily_reminder_time === "string") {
      const t = input.daily_reminder_time;
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(t))
        throw new Error("Invalid reminder time format");
      const [hh, mm] = t.split(":").map(Number);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
        throw new Error("Invalid reminder time");
      out.daily_reminder_time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
    if (Object.keys(out).length === 0) throw new Error("No changes to save");
    return out;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });




