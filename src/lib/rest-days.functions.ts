import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localDateFor } from "@/lib/daily-posts.functions";
import type { SupabaseClient } from "@supabase/supabase-js";

// App-wide rule: at most this many rest days in any rolling 7-day window.
export const REST_DAYS_PER_WEEK = 2;

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function restInfo(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  const tz = (profile as { timezone?: string } | null)?.timezone ?? "UTC";
  const today = localDateFor(tz);
  const weekStart = addDays(today, -6);
  const [{ data: rows }, { data: todayCheckins }] = await Promise.all([
    supabase
      .from("streak_freezes_used")
      .select("freeze_date")
      .eq("user_id", userId)
      .eq("kind" as never, "rest")
      .gte("freeze_date", weekStart)
      .lte("freeze_date", today),
    supabase
      .from("check_ins")
      .select("id")
      .eq("user_id", userId)
      .eq("checkin_date", today)
      .limit(1),
  ]);
  const dates = new Set((rows ?? []).map((r: { freeze_date: string }) => r.freeze_date));
  return {
    today,
    used: dates.size,
    remaining: Math.max(0, REST_DAYS_PER_WEEK - dates.size),
    restingToday: dates.has(today),
    checkedInToday: (todayCheckins ?? []).length > 0,
  };
}

export const getRestDayInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await restInfo(context.supabase, context.userId);
    return { ...r, limit: REST_DAYS_PER_WEEK };
  });

export const takeRestDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await restInfo(supabase, userId);
    if (r.restingToday) return { ok: true, remaining: r.remaining };
    if (r.checkedInToday) throw new Error("You already checked in today");
    if (r.remaining <= 0)
      throw new Error(`You've used your ${REST_DAYS_PER_WEEK} rest days this week`);

    const { data: groups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    const rows = (groups ?? []).map((g: { group_id: string }) => ({
      user_id: userId,
      group_id: g.group_id,
      freeze_date: r.today,
      kind: "rest",
    }));
    if (rows.length === 0) throw new Error("Join a group first");
    const { error } = await supabase
      .from("streak_freezes_used")
      .upsert(rows as never, {
        onConflict: "user_id,group_id,freeze_date",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(error.message);
    return { ok: true, remaining: r.remaining - 1 };
  });
