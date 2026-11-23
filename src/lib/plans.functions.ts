import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signAvatarThumbs } from "@/lib/media-urls";
import {
  latestLeftRun,
  planStartAction,
  planWorkoutsDone,
  type CrewOnPlan,
  type MuscleMap,
  type Plan,
  type PlanDay,
  type PlanGoal,
  type PlanMove,
  type UserPlanRow,
  type WeekNote,
} from "@/lib/workout-plans";

/** The published plan catalog with every day's moves. */
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Plan[]> => {
    const { supabase } = context;
    const [plansRes, daysRes] = await Promise.all([
      supabase
        .from("plans")
        .select("id, slug, name, goal, level, weeks, days_per_week, minutes, gear, summary, progression_rule, safety_note, note, sort_order, cover_url, cover_credit, focus_line, gear_short, week_notes")
        .eq("is_published", true)
        .order("sort_order"),
      supabase.from("plan_days").select("plan_id, day_number, week_number, title, minutes, note, moves, muscles"),
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
        muscles: (d.muscles && typeof d.muscles === "object" && !Array.isArray(d.muscles) ? d.muscles : {}) as MuscleMap,
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
      coverUrl: p.cover_url,
      coverCredit: p.cover_credit,
      focusLine: p.focus_line,
      gearShort: p.gear_short,
      weekNotes: (Array.isArray(p.week_notes) ? p.week_notes : []) as unknown as WeekNote[],
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
  /** Plan days checked in on this run. */
  workoutsDone: number;
};

/** The run you left most recently, per plan (what "Pick up at week N" resumes). */
export type MyLeftPlan = { id: string; planId: string; slug: string; name: string; weeks: number; currentWeek: number; nextDay: number; workoutsDone: number };

export type MyPlans = {
  active: MyActivePlan | null;
  completed: { id: string; slug: string; name: string; weeks: number; completedAt: string | null }[];
  left: MyLeftPlan[];
};

/** Your active plan (if any) and the plans you've finished, newest first. */
export const getMyPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPlans> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_plans")
      .select("id, plan_id, status, current_week, next_day, started_at, completed_at, updated_at, plans(slug, name, weeks, days_per_week)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []).filter((r) => (r as any).plans);
    type P = { slug: string; name: string; weeks: number; days_per_week: number };
    const plan = (r: (typeof rows)[number]) => (r as any).plans as P;
    const activeRow = rows.find((r) => r.status === "active") ?? null;
    const leftRows: typeof rows = [];
    for (const planId of new Set(rows.map((r) => r.plan_id))) {
      if (activeRow?.plan_id === planId) continue;
      const run = latestLeftRun(
        rows.map((r) => ({ ...r, planId: r.plan_id, status: r.status as UserPlanRow["status"], updatedAt: r.updated_at })),
        planId,
      );
      if (run) leftRows.push(rows.find((r) => r.id === run.id)!);
    }
    const counted = [activeRow, ...leftRows].filter((r): r is NonNullable<typeof r> => !!r).map((r) => r.id);
    const done = new Map<string, number>();
    if (counted.length) {
      const { data: logs } = await supabase.from("plan_workout_logs").select("user_plan_id, week, day_number").in("user_plan_id", counted);
      for (const id of counted) done.set(id, planWorkoutsDone((logs ?? []).filter((l) => l.user_plan_id === id)));
    }
    const active: MyActivePlan | null = activeRow
      ? {
          id: activeRow.id,
          planId: activeRow.plan_id,
          slug: plan(activeRow).slug,
          name: plan(activeRow).name,
          currentWeek: activeRow.current_week,
          nextDay: activeRow.next_day,
          weeks: plan(activeRow).weeks,
          daysPerWeek: plan(activeRow).days_per_week,
          startedAt: activeRow.started_at,
          workoutsDone: done.get(activeRow.id) ?? 0,
        }
      : null;
    const completed: MyPlans["completed"] = rows
      .filter((r) => r.status === "completed")
      .map((r) => ({ id: r.id, slug: plan(r).slug, name: plan(r).name, weeks: plan(r).weeks, completedAt: r.completed_at }));
    const left: MyLeftPlan[] = leftRows.map((r) => ({
      id: r.id,
      planId: r.plan_id,
      slug: plan(r).slug,
      name: plan(r).name,
      weeks: plan(r).weeks,
      currentWeek: r.current_week,
      nextDay: r.next_day,
      workoutsDone: done.get(r.id) ?? 0,
    }));
    return { active, completed, left };
  });

/**
 * Leave your plan: it stops being active (no plan card, no plan tag on new
 * check-ins). Progress, logged workouts and past posts' plan chips stay; the
 * subscription isn't touched.
 */
export const leavePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userPlanId: string }) => ({ userPlanId: String(input?.userPlanId ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_plans")
      .update({ status: "stopped", updated_at: new Date().toISOString() })
      .eq("id", data.userPlanId)
      .eq("user_id", userId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true };
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
  .inputValidator((input: { planId: string; fresh?: boolean }) => ({ planId: String(input?.planId ?? ""), fresh: input?.fresh === true }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase.from("plans").select("id").eq("id", data.planId).eq("is_published", true).maybeSingle();
    if (!plan) throw new Error("That plan isn't available.");
    const { data: rows, error } = await supabase
      .from("user_plans")
      .select("id, plan_id, status, updated_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    // "Start over from week 1" starts a fresh run; the left one keeps its history.
    const action = planStartAction(
      (rows ?? []).map((r) => ({ id: r.id, planId: r.plan_id, status: r.status as UserPlanRow["status"], updatedAt: r.updated_at })),
      data.planId,
      { fresh: data.fresh },
    );
    if (action.stopIds.length) {
      const { error: stopErr } = await supabase.from("user_plans").update({ status: "stopped", updated_at: new Date().toISOString() }).in("id", action.stopIds);
      if (stopErr) throw new Error(stopErr.message);
    }
    if (action.alreadyActiveId) return { userPlanId: action.alreadyActiveId };
    if (action.resumeId) {
      const { error: resumeErr } = await supabase.from("user_plans").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", action.resumeId);
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

export type CrewOnPlanPerson = CrewOnPlan & { userId: string; avatarUrl: string | null; avatarColor: string };

/** Crewmates who are on, or finished, one plan (for the plan page). */
export const getCrewOnPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planId: string }) => ({ planId: String(input?.planId ?? "") }))
  .handler(async ({ data, context }): Promise<CrewOnPlanPerson[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("crew_on_plan", { _plan_id: data.planId });
    if (error) {
      console.error("[plans] crew on plan failed", error);
      return [];
    }
    const list = (rows ?? []) as { user_id: string; status: string; current_week: number }[];
    if (list.length === 0) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, avatar_color, avatar_url")
      .in("id", list.map((r) => r.user_id));
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const avatarUrls = await signAvatarThumbs(
      supabase as SupabaseClient,
      (profiles ?? []).map((p) => p.avatar_url),
      96,
    );
    return list
      .map((r) => {
        const prof = byId.get(r.user_id);
        return {
          userId: r.user_id,
          firstName: ((prof?.name ?? "").trim().split(" ")[0] || "Member") as string,
          avatarUrl: prof?.avatar_url ? avatarUrls.get(prof.avatar_url) ?? null : null,
          avatarColor: prof?.avatar_color ?? "#7C3AED",
          status: (r.status === "completed" ? "completed" : "active") as CrewOnPlan["status"],
          currentWeek: r.current_week,
        };
      })
      // Finished first, then by name, so the line reads the same every time.
      .sort((a, b) => (a.status === b.status ? a.firstName.localeCompare(b.firstName) : a.status === "completed" ? -1 : 1));
  });
