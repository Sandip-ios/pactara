import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localDateFor } from "@/lib/daily-posts.functions";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Look back this many days to offer freeze-eligible missed days. */
const LOOKBACK_DAYS = 14;

export const getStreakFreezeInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null }) => ({
    groupId: input?.groupId ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("streak_freezes_available, timezone")
      .eq("id", userId)
      .maybeSingle();
    const available = (profile as { streak_freezes_available?: number } | null)
      ?.streak_freezes_available ?? 0;
    const timezone = (profile as { timezone?: string } | null)?.timezone ?? "UTC";

    // Pick a group: requested, else most recent membership
    let groupId = data.groupId;
    if (!groupId) {
      const { data: m } = await supabase
        .from("group_members")
        .select("group_id, joined_at")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      groupId = m?.group_id ?? null;
    }

    if (!groupId) {
      return { available, groupId: null as string | null, missedDates: [] as string[] };
    }

    // Verify membership + get joined_at
    const { data: membership } = await supabase
      .from("group_members")
      .select("joined_at")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .maybeSingle();
    if (!membership) {
      return { available, groupId, missedDates: [] as string[] };
    }
    const joinedDate = localDateFor(timezone, new Date(membership.joined_at as string));

    const today = localDateFor(timezone);
    // Build lookback window (exclude today)
    const window: string[] = [];
    const cursor = new Date(`${today}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    for (let i = 0; i < LOOKBACK_DAYS; i++) {
      const s = ymd(cursor);
      if (s < joinedDate) break;
      window.push(s);
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    if (window.length === 0) {
      return { available, groupId, missedDates: [] };
    }

    const [{ data: checkIns }, { data: freezes }] = await Promise.all([
      supabase
        .from("check_ins")
        .select("checkin_date")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .in("checkin_date", window),
      supabase
        .from("streak_freezes_used")
        .select("freeze_date")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .in("freeze_date", window),
    ]);

    const checkedSet = new Set(
      (checkIns ?? []).map((c: { checkin_date: string }) => c.checkin_date),
    );
    const frozenSet = new Set(
      (freezes ?? []).map((f: { freeze_date: string }) => f.freeze_date),
    );
    const missedDates = window.filter((d) => !checkedSet.has(d) && !frozenSet.has(d));

    return { available, groupId, missedDates };
  });

export const applyStreakFreeze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; date: string }) => {
    if (!input?.groupId) throw new Error("Missing group");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.date ?? ""))
      throw new Error("Invalid date");
    return { groupId: String(input.groupId), date: String(input.date) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify membership
    const { data: m } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId)
      .eq("group_id", data.groupId)
      .maybeSingle();
    if (!m) throw new Error("You're not a member of this group");

    // Check available count
    const { data: profile } = await supabase
      .from("profiles")
      .select("streak_freezes_available")
      .eq("id", userId)
      .maybeSingle();
    const available = (profile as { streak_freezes_available?: number } | null)
      ?.streak_freezes_available ?? 0;
    if (available <= 0) throw new Error("No streak freezes remaining");

    // Ensure the date isn't already covered by a check-in
    const { data: existing } = await supabase
      .from("check_ins")
      .select("id")
      .eq("user_id", userId)
      .eq("group_id", data.groupId)
      .eq("checkin_date", data.date)
      .maybeSingle();
    if (existing) throw new Error("You already checked in that day");

    const { error: insertErr } = await supabase
      .from("streak_freezes_used")
      .insert({
        user_id: userId,
        group_id: data.groupId,
        freeze_date: data.date,
      } as never);
    if (insertErr) {
      if ((insertErr as { code?: string }).code === "23505")
        throw new Error("A freeze was already applied to that day");
      throw new Error(insertErr.message);
    }

    // Atomic-ish decrement: filter by current count
    const { error: decErr, data: updated } = await supabase
      .from("profiles")
      .update({ streak_freezes_available: available - 1 } as never)
      .eq("id", userId)
      .eq("streak_freezes_available" as never, available)
      .select("streak_freezes_available");
    if (decErr || !updated || updated.length === 0) {
      // Roll back the freeze insertion if we lost the race
      await supabase
        .from("streak_freezes_used")
        .delete()
        .eq("user_id", userId)
        .eq("group_id", data.groupId)
        .eq("freeze_date", data.date);
      throw new Error("Couldn't apply freeze, please try again");
    }

    return { ok: true, remaining: available - 1 };
  });
