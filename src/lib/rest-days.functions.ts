import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { localWeek, restAllowance, weekDayStates, weeklyTarget, type WeekDayState } from "@/lib/streak-rules";

/**
 * Rest days are automatic: the hourly job uses one when a day closes without a
 * check-in (see auto-miss). This module only reports where each group stands
 * for the member's current Mon–Sun week, in their own timezone.
 */
export type GroupWeekStatus = {
  groupId: string;
  workouts: number;
  target: number;
  restAllowance: number;
  restUsed: number;
  restLeft: number;
  /** Monday → Sunday: checked in, rested/frozen, or nothing. */
  days: { date: string; state: WeekDayState }[];
};

async function restInfo(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  const tz = (profile as { timezone?: string } | null)?.timezone ?? "UTC";
  const { today, weekStart, weekEnd } = localWeek(tz);

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, groups!inner(ended_at)").is("groups.ended_at", null)
    .eq("user_id", userId);
  const groupIds = (memberships ?? []).map((m: { group_id: string }) => m.group_id);
  const safeIds = groupIds.length ? groupIds : ["00000000-0000-0000-0000-000000000000"];

  const [{ data: groups }, { data: rests }, { data: checkIns }] = await Promise.all([
    supabase.from("groups").select("id, frequency, days_per_week").is("ended_at", null).in("id", safeIds),
    supabase
      .from("streak_freezes_used")
      .select("group_id, freeze_date, kind")
      .eq("user_id", userId)
      .in("group_id", safeIds)
      .gte("freeze_date", weekStart)
      .lte("freeze_date", weekEnd),
    supabase
      .from("check_ins")
      .select("group_id, checkin_date")
      .eq("user_id", userId)
      .in("group_id", safeIds)
      .gte("checkin_date", weekStart)
      .lte("checkin_date", today),
  ]);

  // Rest rows use up the week's rest days; freeze rows only cover a day.
  const restsByGroup = new Map<string, Set<string>>();
  const coveredByGroup = new Map<string, Set<string>>();
  for (const r of (rests ?? []) as { group_id: string; freeze_date: string; kind: string | null }[]) {
    if (!coveredByGroup.has(r.group_id)) coveredByGroup.set(r.group_id, new Set());
    coveredByGroup.get(r.group_id)!.add(r.freeze_date);
    if (r.kind !== "rest") continue;
    if (!restsByGroup.has(r.group_id)) restsByGroup.set(r.group_id, new Set());
    restsByGroup.get(r.group_id)!.add(r.freeze_date);
  }
  const workoutDaysByGroup = new Map<string, Set<string>>();
  for (const c of (checkIns ?? []) as { group_id: string; checkin_date: string }[]) {
    if (!workoutDaysByGroup.has(c.group_id)) workoutDaysByGroup.set(c.group_id, new Set());
    workoutDaysByGroup.get(c.group_id)!.add(c.checkin_date);
  }

  const statuses: GroupWeekStatus[] = (groups ?? []).map(
    (g: { id: string; frequency: string | null; days_per_week: number | null }) => {
      const allowance = restAllowance(g);
      const used = restsByGroup.get(g.id)?.size ?? 0;
      return {
        groupId: g.id,
        workouts: workoutDaysByGroup.get(g.id)?.size ?? 0,
        target: weeklyTarget(g),
        restAllowance: allowance,
        restUsed: used,
        restLeft: Math.max(0, allowance - used),
        days: weekDayStates(
          weekStart,
          workoutDaysByGroup.get(g.id) ?? new Set(),
          coveredByGroup.get(g.id) ?? new Set(),
        ),
      };
    },
  );

  const restingToday = [...restsByGroup.values()].some((s) => s.has(today));
  const checkedInToday = [...workoutDaysByGroup.values()].some((s) => s.has(today));
  return {
    today,
    weekStart,
    weekEnd,
    groups: statuses,
    restingToday,
    checkedInToday,
    // Kept for the check-in screen's rest-day message (fewest left across groups).
    remaining: statuses.length ? Math.min(...statuses.map((s) => s.restLeft)) : 0,
  };
}

export const getRestDayInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => restInfo(context.supabase, context.userId));
