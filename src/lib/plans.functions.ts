import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signAvatarThumbs } from "@/lib/media-urls";
import { planStartAction, type Plan, type PlanDay, type PlanGoal, type PlanMove, type UserPlanRow } from "@/lib/workout-plans";

/** The published plan catalog with every day's moves. */
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Plan[]> => {
    const { supabase } = context;
    const [plansRes, daysRes] = await Promise.all([
      supabase
        .from("plans")
        .select("id, slug, name, goal, level, weeks, days_per_week, minutes, gear, summary, progression_rule, safety_note, note, sort_order")
        .eq("is_published", true)
        .order("sort_order"),
      supabase.from("plan_days").select("plan_id, day_number, week_number, title, minutes, note, moves"),
    ]);
    if (plansRes.error) throw new Error(plansRes.error.message);
    const daysByPlan = new Map<string, PlanDay[]>();
    for (const d of daysRes.data ?? []) {
      const list = daysByPlan.get(d.plan_id) ?? [];
      list.push({
        dayNumber: d.day_number,
        weekNumber: d.week_number,
        title: d.title,
        minutes: d.minutes,
        note: d.note,
        moves: (Array.isArray(d.moves) ? d.moves : []) as unknown as PlanMove[],
      });
      daysByPlan.set(d.plan_id, list);
    }
    return (plansRes.data ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      goal: p.goal as PlanGoal,
      level: p.level,
      weeks: p.weeks,
      daysPerWeek: p.days_per_week,
      minutes: p.minutes,
      gear: p.gear ?? [],
      summary: p.summary,
      progressionRule: p.progression_rule,
      safetyNote: p.safety_note,
      note: p.note,
      days: (daysByPlan.get(p.id) ?? []).sort(
        (a, b) => a.dayNumber - b.dayNumber || (a.weekNumber ?? 0) - (b.weekNumber ?? 0),
      ),
    }));
  });

export type MyActivePlan = {
  id: string;
  planId: string;
  slug: string;
  name: string;
  currentWeek: number;
  nextDay: number;
  weeks: number;
  daysPerWeek: number;
  startedAt: string;
};

export type MyPlans = {
  active: MyActivePlan | null;
  completed: { id: string; slug: string; name: string; weeks: number; completedAt: string | null }[];
};

/** Your active plan (if any) and the plans you've finished, newest first. */
export const getMyPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPlans> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_plans")
      .select("id, plan_id, status, current_week, next_day, started_at, completed_at, plans(slug, name, weeks, days_per_week)")
      .eq("user_id", userId)
      .in("status", ["active", "completed"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    let active: MyActivePlan | null = null;
    const completed: MyPlans["completed"] = [];
    for (const r of data ?? []) {
      const p = (r as any).plans as { slug: string; name: string; weeks: number; days_per_week: number } | null;
      if (!p) continue;
      if (r.status === "active" && !active) {
        active = {
          id: r.id,
          planId: r.plan_id,
          slug: p.slug,
          name: p.name,
          currentWeek: r.current_week,
          nextDay: r.next_day,
          weeks: p.weeks,
          daysPerWeek: p.days_per_week,
          startedAt: r.started_at,
        };
      } else if (r.status === "completed") {
        completed.push({ id: r.id, slug: p.slug, name: p.name, weeks: p.weeks, completedAt: r.completed_at });
      }
    }
    return { active, completed };
  });

export type CrewPlan = {
  userId: string;
  firstName: string;
  avatarUrl: string | null;
  avatarColor: string;
  slug: string;
  planName: string;
  currentWeek: number;
  weeks: number;
};

/** Crewmates' active plans for "Your crew is doing". */
export const getCrewPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrewPlan[]> => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("crew_active_plans");
    if (error) {
      console.error("[plans] crew plans failed", error);
      return [];
    }
    const rows = (data ?? []) as { user_id: string; plan_slug: string; plan_name: string; current_week: number; weeks: number }[];
    if (rows.length === 0) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, avatar_color, avatar_url")
      .in("id", rows.map((r) => r.user_id));
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const avatarUrls = await signAvatarThumbs(
      supabase as SupabaseClient,
      (profiles ?? []).map((p) => p.avatar_url),
      96,
    );
    return rows
      .map((r) => {
        const prof = byId.get(r.user_id);
        return {
          userId: r.user_id,
          firstName: ((prof?.name ?? "").trim().split(" ")[0] || "Member") as string,
          avatarUrl: prof?.avatar_url ? avatarUrls.get(prof.avatar_url) ?? null : null,
          avatarColor: prof?.avatar_color ?? "#7C3AED",
          slug: r.plan_slug,
          planName: r.plan_name,
          currentWeek: r.current_week,
          weeks: r.weeks,
        };
      })
      .sort((a, b) => a.firstName.localeCompare(b.firstName));
  });

/**
 * Start (or switch to) a plan. One active plan per person: the current one is
 * stopped with its progress kept, and a stopped run of the chosen plan resumes.
 * The membership gate runs on the device before this is called.
 */
export const startPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planId: string }) => ({ planId: String(input?.planId ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase.from("plans").select("id").eq("id", data.planId).eq("is_published", true).maybeSingle();
    if (!plan) throw new Error("That plan isn't available.");
    const { data: rows, error } = await supabase
      .from("user_plans")
      .select("id, plan_id, status")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const action = planStartAction(
      (rows ?? []).map((r) => ({ id: r.id, planId: r.plan_id, status: r.status as UserPlanRow["status"] })),
      data.planId,
    );
    if (action.stopIds.length) {
      const { error: stopErr } = await supabase.from("user_plans").update({ status: "stopped" }).in("id", action.stopIds);
      if (stopErr) throw new Error(stopErr.message);
    }
    if (action.alreadyActiveId) return { userPlanId: action.alreadyActiveId };
    if (action.resumeId) {
      const { error: resumeErr } = await supabase.from("user_plans").update({ status: "active" }).eq("id", action.resumeId);
      if (resumeErr) throw new Error(resumeErr.message);
      return { userPlanId: action.resumeId };
    }
    const { data: created, error: insErr } = await supabase
      .from("user_plans")
      .insert({ user_id: userId, plan_id: data.planId })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { userPlanId: created.id };
  });
