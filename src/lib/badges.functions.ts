import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BADGE_MILESTONES } from "./badges";

function bestStreakFromDates(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
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
  return best;
}

/** Compute user's overall best streak across all groups and insert any newly earned milestone badges. */
export async function awardBadgesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number[]> {
  const { data: rows } = await supabase
    .from("check_ins")
    .select("checkin_date")
    .eq("user_id", userId);
  const dates = ((rows ?? []) as { checkin_date: string }[]).map(
    (r) => r.checkin_date,
  );
  const bestOverall = bestStreakFromDates(dates);

  const { data: existing } = await supabase
    .from("earned_badges")
    .select("streak_days")
    .eq("user_id", userId);
  const already = new Set(
    ((existing ?? []) as { streak_days: number }[]).map((e) => e.streak_days),
  );

  const toInsert = BADGE_MILESTONES.filter(
    (m) => m <= bestOverall && !already.has(m),
  );
  if (toInsert.length === 0) return [];

  const now = new Date().toISOString();
  const rowsToInsert = toInsert.map((m) => ({
    user_id: userId,
    streak_days: m,
    earned_at: now,
  }));
  await supabase.from("earned_badges").insert(rowsToInsert);
  return [...toInsert];
}

export type EarnedBadge = { streakDays: number; earnedAt: string };

export const getMyBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EarnedBadge[]> => {
    const { supabase, userId } = context;
    // Backfill: award any milestones already reached but never recorded.
    await awardBadgesForUser(supabase, userId);
    const { data } = await supabase
      .from("earned_badges")
      .select("streak_days, earned_at")
      .eq("user_id", userId)
      .order("streak_days", { ascending: true });
    return ((data ?? []) as { streak_days: number; earned_at: string }[]).map(
      (r) => ({ streakDays: r.streak_days, earnedAt: r.earned_at }),
    );
  });
