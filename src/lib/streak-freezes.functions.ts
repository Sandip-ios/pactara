import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localDateFor } from "@/lib/daily-posts.functions";
import type { SupabaseClient } from "@supabase/supabase-js";

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function resolveEligibility(
  supabase: SupabaseClient,
  userId: string,
  requestedGroupId: string | null,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_freezes_available, timezone")
    .eq("id", userId)
    .maybeSingle();
  const available =
    (profile as { streak_freezes_available?: number } | null)
      ?.streak_freezes_available ?? 0;
  const timezone = (profile as { timezone?: string } | null)?.timezone ?? "UTC";

  let groupId = requestedGroupId;
  if (!groupId) {
    const { data: m } = await supabase
      .from("group_members")
      .select("group_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    groupId = (m?.group_id as string | undefined) ?? null;
  }

  if (!groupId) {
    return {
      available,
      timezone,
      groupId: null as string | null,
      eligibleDate: null as string | null,
      reason: "no_group" as const,
    };
  }

  const { data: membership } = await supabase
    .from("group_members")
    .select("joined_at")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (!membership) {
    return {
      available,
      timezone,
      groupId,
      eligibleDate: null,
      reason: "not_member" as const,
    };
  }
  const joinedDate = localDateFor(timezone, new Date(membership.joined_at as string));

  const today = localDateFor(timezone);
  const yesterday = addDays(today, -1);
  const dayBefore = addDays(today, -2);

  // Must have been in the group by yesterday
  if (yesterday < joinedDate) {
    return {
      available,
      timezone,
      groupId,
      eligibleDate: null,
      reason: "too_new" as const,
    };
  }

  // Fetch yesterday's + day-before's check-ins and applied freezes.
  const window = [yesterday, dayBefore];
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
  const isCovered = (d: string) => checkedSet.has(d) || frozenSet.has(d);

  // If yesterday is already covered, nothing to freeze.
  if (isCovered(yesterday)) {
    return {
      available,
      timezone,
      groupId,
      eligibleDate: null,
      reason: "no_missed_day" as const,
    };
  }

  // Streak must still be alive going into yesterday — i.e., day before was covered
  // OR yesterday was the user's first eligible day (joined yesterday).
  const streakAlive = isCovered(dayBefore) || dayBefore < joinedDate;
  if (!streakAlive) {
    return {
      available,
      timezone,
      groupId,
      eligibleDate: null,
      reason: "streak_lost" as const,
    };
  }

  return {
    available,
    timezone,
    groupId,
    eligibleDate: yesterday,
    reason: "eligible" as const,
  };
}

export const getStreakFreezeInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { groupId?: string | null }) => ({
    groupId: input?.groupId ?? null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const res = await resolveEligibility(supabase, userId, data.groupId);
    return {
      available: res.available,
      groupId: res.groupId,
      eligibleDate: res.eligibleDate,
      reason: res.reason,
    };
  });

export const applyStreakFreeze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => {
    if (!input?.groupId) throw new Error("Missing group");
    return { groupId: String(input.groupId) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const res = await resolveEligibility(supabase, userId, data.groupId);
    if (res.available <= 0) throw new Error("No streak freezes remaining");
    if (!res.eligibleDate) {
      const messages: Record<string, string> = {
        no_group: "You're not in a group yet",
        not_member: "You're not a member of this group",
        too_new: "You just joined — nothing to freeze yet",
        no_missed_day: "Yesterday is already covered",
        streak_lost:
          "Too late — your streak already broke. Freezes only protect yesterday.",
      };
      throw new Error(messages[res.reason] ?? "Freeze not available");
    }

    const { error: insertErr } = await supabase
      .from("streak_freezes_used")
      .insert({
        user_id: userId,
        group_id: res.groupId!,
        freeze_date: res.eligibleDate,
      } as never);
    if (insertErr) {
      if ((insertErr as { code?: string }).code === "23505")
        throw new Error("A freeze was already applied to that day");
      throw new Error(insertErr.message);
    }

    // Optimistic-concurrency decrement
    const { data: updated, error: decErr } = await supabase
      .from("profiles")
      .update({ streak_freezes_available: res.available - 1 } as never)
      .eq("id", userId)
      .eq("streak_freezes_available" as never, res.available)
      .select("streak_freezes_available");
    if (decErr || !updated || updated.length === 0) {
      await supabase
        .from("streak_freezes_used")
        .delete()
        .eq("user_id", userId)
        .eq("group_id", res.groupId!)
        .eq("freeze_date", res.eligibleDate);
      throw new Error("Couldn't apply freeze, please try again");
    }

    return {
      ok: true,
      remaining: res.available - 1,
      frozenDate: res.eligibleDate,
    };
  });
