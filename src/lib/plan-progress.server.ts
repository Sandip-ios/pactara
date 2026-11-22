import type { SupabaseClient } from "@supabase/supabase-js";
import { advancePlan, type PlanDayResult } from "@/lib/workout-plans";

export type PlanDayInput = { userPlanId: string; week: number; day: number };

/**
 * Logs a checked-in plan day and moves the plan to its next day. Runs as the
 * signed-in user (RLS: own plan rows only). One log row per posted check-in
 * copy (a check-in shared to several crews), so every crew's feed can show the
 * plan tag; the plan itself advances once. A day that isn't the plan's next
 * day (already logged, or the plan moved on) is ignored, so retries never
 * skip a day.
 */
export async function logPlanWorkout(
  supabase: SupabaseClient,
  userId: string,
  input: PlanDayInput,
  checkInIds: string[],
): Promise<PlanDayResult | null> {
  const { data: up } = await supabase
    .from("user_plans")
    .select("id, user_id, status, current_week, next_day, plans(slug, name, weeks, days_per_week)")
    .eq("id", input.userPlanId)
    .eq("user_id", userId)
    .maybeSingle();
  const plan = (up as any)?.plans as { slug: string; name: string; weeks: number; days_per_week: number } | null;
  if (!up || !plan || up.status !== "active") return null;
  if (up.current_week !== input.week || up.next_day !== input.day) return null;

  const next = advancePlan({ week: input.week, day: input.day }, { weeks: plan.weeks, daysPerWeek: plan.days_per_week });
  const { data: moved, error: moveErr } = await supabase
    .from("user_plans")
    .update(
      next.completed
        ? { status: "completed", completed_at: new Date().toISOString() }
        : { current_week: next.week, next_day: next.day },
    )
    .eq("id", up.id)
    .eq("status", "active")
    .eq("current_week", input.week)
    .eq("next_day", input.day)
    .select("id");
  if (moveErr) throw new Error(moveErr.message);
  // Another request already advanced this day.
  if (!moved || moved.length === 0) return null;

  const rows = (checkInIds.length ? checkInIds : [null]).map((checkInId) => ({
    user_plan_id: up.id,
    week: input.week,
    day_number: input.day,
    check_in_id: checkInId,
  }));
  const { error: logErr } = await supabase.from("plan_workout_logs").insert(rows);
  if (logErr) console.error("[plans] workout log failed", logErr);

  return {
    slug: plan.slug,
    planName: plan.name,
    completed: next.completed,
    nextWeek: next.week,
    nextDay: next.day,
  };
}

/** Plan tags for feed check-ins (only for crews the viewer belongs to). */
export async function planTagsForCheckIns(
  supabase: SupabaseClient,
  checkInIds: string[],
): Promise<Map<string, { name: string; slug: string; week: number; day: number }>> {
  const out = new Map<string, { name: string; slug: string; week: number; day: number }>();
  if (checkInIds.length === 0) return out;
  const { data, error } = await supabase.rpc("plan_tags_for_check_ins", { _check_in_ids: checkInIds });
  if (error) {
    console.error("[plans] plan tags failed", error);
    return out;
  }
  for (const r of (data ?? []) as { check_in_id: string; plan_name: string; plan_slug: string; week: number; day_number: number }[]) {
    out.set(r.check_in_id, { name: r.plan_name, slug: r.plan_slug, week: r.week, day: r.day_number });
  }
  return out;
}
