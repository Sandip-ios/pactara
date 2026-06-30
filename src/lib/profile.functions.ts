import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeStreaks(dates: string[]) {
  const set = new Set(dates);
  // current streak (ending today or yesterday)
  let current = 0;
  const today = new Date();
  let cursor = new Date(today);
  if (!set.has(ymd(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (set.has(ymd(cursor))) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  // best streak
  const sorted = [...dates].sort();
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

export const getProfileOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_color, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    let avatarSignedUrl: string | null = null;
    const avatarPath = (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null;
    if (avatarPath) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(avatarPath, 60 * 60);
      avatarSignedUrl = signed?.signedUrl ?? null;
    }

    const { data: membership } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let groupName: string | null = null;
    if (membership) {
      const { data: g } = await supabase
        .from("groups")
        .select("name")
        .eq("id", membership.group_id)
        .maybeSingle();
      groupName = g?.name ?? null;
    }

    // Earliest joined_at across all groups → days active in the app
    const { data: firstMembership } = await supabase
      .from("group_members")
      .select("joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("checkin_date")
      .eq("user_id", userId);

    const dates = (checkIns ?? []).map((c: { checkin_date: string }) => c.checkin_date);
    const { current, best } = computeStreaks(dates);

    const past7: { date: string; checked: boolean }[] = [];
    const set = new Set(dates);
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const s = ymd(d);
      past7.push({ date: s, checked: set.has(s) });
    }

    // Check-in rate: distinct days checked in vs days since joining
    const uniqueDays = new Set(dates).size;
    const joinedAt = (firstMembership as { joined_at?: string } | null)?.joined_at;
    let daysSinceJoin = 1;
    if (joinedAt) {
      const joinDate = new Date(joinedAt);
      const diffMs = Date.now() - joinDate.getTime();
      daysSinceJoin = Math.max(1, Math.floor(diffMs / 86400000) + 1);
    }
    const checkInRatePct = Math.min(
      100,
      Math.round((uniqueDays / daysSinceJoin) * 100),
    );

    // This week vs last week (rolling 7-day windows)
    const now = Date.now();
    const dayMs = 86400000;
    const last7Cut = now - 7 * dayMs;
    const prev7Cut = now - 14 * dayMs;
    let thisWeek = 0;
    let lastWeek = 0;
    for (const s of dates) {
      const t = new Date(s + "T00:00:00Z").getTime();
      if (t >= last7Cut) thisWeek += 1;
      else if (t >= prev7Cut) lastWeek += 1;
    }

    // On-time rate: check-ins posted on their own day vs total expected
    // (check-ins + missed check-in days recorded in daily_posts)
    const { count: missedCount } = await supabase
      .from("daily_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("check_in_missed", true);
    const totalExpected = dates.length + (missedCount ?? 0);
    const onTimeRatePct =
      totalExpected > 0
        ? Math.round((dates.length / totalExpected) * 100)
        : 0;

    return {
      name: profile?.name ?? "",
      avatarColor: profile?.avatar_color ?? "#7C3AED",
      avatarUrl: avatarSignedUrl,
      groupName,
      totalCheckIns: dates.length,
      currentStreak: current,
      bestStreak: best,
      past7,
      checkInRatePct,
      daysSinceJoin,
      uniqueDaysCheckedIn: uniqueDays,
      thisWeek,
      lastWeek,
      onTimeRatePct,
      missedCount: missedCount ?? 0,
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
};

const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  email_enabled: true,
  daily_reminder_enabled: true,
  daily_reminder_time: "09:00",
  group_activity_enabled: true,
  morning_ritual_reminder_enabled: false,
};

export const getNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPrefs> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notification_preferences")
      .select(
        "push_enabled, email_enabled, daily_reminder_enabled, daily_reminder_time, group_activity_enabled, morning_ritual_reminder_enabled",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const prefs = (data ?? DEFAULT_PREFS) as NotificationPrefs;
    return {
      push_enabled: !!prefs.push_enabled,
      email_enabled: !!prefs.email_enabled,
      daily_reminder_enabled: !!prefs.daily_reminder_enabled,
      daily_reminder_time: String(prefs.daily_reminder_time).slice(0, 5),
      group_activity_enabled: !!prefs.group_activity_enabled,
      morning_ritual_reminder_enabled: !!prefs.morning_ritual_reminder_enabled,
    };
  });

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<NotificationPrefs>) => {
    const out: Partial<NotificationPrefs> = {};
    if (typeof input.push_enabled === "boolean") out.push_enabled = input.push_enabled;
    if (typeof input.email_enabled === "boolean") out.email_enabled = input.email_enabled;
    if (typeof input.daily_reminder_enabled === "boolean")
      out.daily_reminder_enabled = input.daily_reminder_enabled;
    if (typeof input.group_activity_enabled === "boolean")
      out.group_activity_enabled = input.group_activity_enabled;
    if (typeof input.morning_ritual_reminder_enabled === "boolean")
      out.morning_ritual_reminder_enabled = input.morning_ritual_reminder_enabled;
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




