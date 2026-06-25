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

    return {
      name: profile?.name ?? "",
      avatarColor: profile?.avatar_color ?? "#7C3AED",
      avatarUrl: avatarSignedUrl,
      groupName,
      totalCheckIns: dates.length,
      currentStreak: current,
      bestStreak: best,
      past7,
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
  .inputValidator((input: { name: string }) => ({
    name: String(input?.name ?? "").trim().slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.name) throw new Error("Name can't be empty");
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
  daily_reminder_time: string; // "HH:MM" or "HH:MM:SS"
  group_activity_enabled: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  email_enabled: true,
  daily_reminder_enabled: true,
  daily_reminder_time: "09:00",
  group_activity_enabled: true,
};

export const getNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await (supabase as never as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (
            c: string,
            v: string,
          ) => { maybeSingle: () => Promise<{ data: NotificationPrefs | null }> };
        };
      };
    })
      .from("notification_preferences")
      .select(
        "push_enabled, email_enabled, daily_reminder_enabled, daily_reminder_time, group_activity_enabled",
      )
      .eq("user_id", userId)
      .maybeSingle();
    const prefs = data ?? DEFAULT_PREFS;
    return {
      ...prefs,
      daily_reminder_time: String(prefs.daily_reminder_time).slice(0, 5),
    };
  });

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<NotificationPrefs>) => {
    const t = input.daily_reminder_time;
    return {
      push_enabled: input.push_enabled,
      email_enabled: input.email_enabled,
      daily_reminder_enabled: input.daily_reminder_enabled,
      daily_reminder_time:
        typeof t === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(t) ? t.slice(0, 5) : undefined,
      group_activity_enabled: input.group_activity_enabled,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = { user_id: userId };
    for (const [k, v] of Object.entries(data)) if (v !== undefined) payload[k] = v;
    const { error } = await (supabase as never as {
      from: (t: string) => {
        upsert: (
          row: Record<string, unknown>,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    })
      .from("notification_preferences")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


