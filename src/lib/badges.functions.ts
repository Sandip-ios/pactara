import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BADGE_MILESTONES } from "./badges";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

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
  supabase: {
    from: (t: string) => {
      select: (
        s: string,
      ) => { eq: (c: string, v: string) => Promise<{ data: unknown }> };
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
    };
  },
  userId: string,
): Promise<number[]> {
  // Pull all check-in dates for user (across all groups)
  const { data: rows } = await (supabase as unknown as {
    from: (t: string) => {
      select: (
        s: string,
      ) => { eq: (c: string, v: string) => Promise<{ data: { checkin_date: string }[] | null }> };
    };
  })
    .from("check_ins")
    .select("checkin_date")
    .eq("user_id", userId);
  const dates = (rows ?? []).map((r) => r.checkin_date);
  // Include today as part of streak calc (check_in should already be inserted)
  const bestOverall = bestStreakFromDates(dates);

  const { data: existing } = await (supabase as unknown as {
    from: (t: string) => {
      select: (
        s: string,
      ) => { eq: (c: string, v: string) => Promise<{ data: { streak_days: number }[] | null }> };
    };
  })
    .from("earned_badges")
    .select("streak_days")
    .eq("user_id", userId);
  const already = new Set((existing ?? []).map((e) => e.streak_days));

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
  await (supabase as unknown as {
    from: (t: string) => { insert: (rows: unknown) => Promise<{ error: unknown }> };
  })
    .from("earned_badges")
    .insert(rowsToInsert);
  return toInsert as number[];
}

export type EarnedBadge = { streakDays: number; earnedAt: string };

export const getMyBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EarnedBadge[]> => {
    const { supabase, userId } = context;
    // Backfill: award any milestones already reached but never recorded.
    await awardBadgesForUser(supabase as never, userId);
    const { data } = await supabase
      .from("earned_badges")
      .select("streak_days, earned_at")
      .eq("user_id", userId)
      .order("streak_days", { ascending: true });
    return (data ?? []).map((r: { streak_days: number; earned_at: string }) => ({
      streakDays: r.streak_days,
      earnedAt: r.earned_at,
    }));
  });

// helper suppress unused warning
void ymd;
