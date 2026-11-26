import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signAvatarThumbs } from "./media-urls";
import { activityOpenUrl } from "./activity-deeplink";

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(" ")[0] || "Member";

export type NewPlanInfo = {
  count: number;
  mate: { firstName: string; crewName: string; currentWeek: number; avatarUrl: string | null } | null;
  /** Your default (most recently joined) active crew, for the start sheet's invite card. */
  crew: { id: string; name: string; invitees: string[]; alreadyOn: string[] } | null;
};

/** New-version plan page: people count, most advanced crewmate, invite card. */
export const getNewPlanInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planId: string }) => z.object({ planId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<NewPlanInfo> => {
    const { supabase, userId } = context;
    const [countRes, onPlanRes, mineRes] = await Promise.all([
      supabase.rpc("plan_active_count", { _plan_id: data.planId }),
      supabase.rpc("crew_on_plan", { _plan_id: data.planId }),
      supabase.from("group_members").select("group_id, joined_at, groups!inner(name, ended_at)").is("groups.ended_at", null).eq("user_id", userId).order("joined_at", { ascending: false }),
    ]);
    const count = (countRes.data as number | null) ?? 0;
    const onPlan = new Map(((onPlanRes.data ?? []) as { user_id: string; status: string; current_week: number }[]).filter((r) => r.status === "active").map((r) => [r.user_id, r.current_week]));
    const myGroups = (mineRes.data ?? []).map((m) => ({ id: m.group_id, name: (m.groups as unknown as { name: string }).name }));
    if (!myGroups.length) return { count, mate: null, crew: null };
    const { data: members } = await supabase.from("group_members").select("user_id, group_id, joined_at").in("group_id", myGroups.map((g) => g.id)).neq("user_id", userId);
    const { blockedPairs } = await import("./safety.server");
    const blocked = await blockedPairs(supabase as SupabaseClient, userId);
    const visible = (members ?? []).filter((m) => !blocked.has(m.user_id));
    const ids = [...new Set(visible.map((m) => m.user_id))];
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, name, avatar_url").in("id", ids) : { data: [] };
    const prof = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Most advanced crewmate on this plan (ties: name).
    const mates = visible.filter((m) => onPlan.has(m.user_id))
      .sort((a, b) => onPlan.get(b.user_id)! - onPlan.get(a.user_id)! || firstName(prof.get(a.user_id)?.name).localeCompare(firstName(prof.get(b.user_id)?.name)));
    let mate: NewPlanInfo["mate"] = null;
    const top = mates[0];
    if (top) {
      const avatar = prof.get(top.user_id)?.avatar_url ?? null;
      const urls = avatar ? await signAvatarThumbs(supabase as SupabaseClient, [avatar], 60) : new Map<string, string>();
      mate = {
        firstName: firstName(prof.get(top.user_id)?.name),
        crewName: myGroups.find((g) => g.id === top.group_id)?.name ?? "your crew",
        currentWeek: onPlan.get(top.user_id)!,
        avatarUrl: avatar ? urls.get(avatar) ?? null : null,
      };
    }
    const home = myGroups[0]!;
    const homeMembers = visible.filter((m) => m.group_id === home.id).sort((a, b) => a.joined_at.localeCompare(b.joined_at));
    const crew = homeMembers.length
      ? {
          id: home.id,
          name: home.name,
          invitees: homeMembers.filter((m) => !onPlan.has(m.user_id)).map((m) => firstName(prof.get(m.user_id)?.name)),
          alreadyOn: homeMembers.filter((m) => onPlan.has(m.user_id)).map((m) => firstName(prof.get(m.user_id)?.name)),
        }
      : null;
    return { count, mate, crew };
  });

export type PlanRunProgress = {
  startsOn: string | null;
  trainingDays: number[] | null;
  pausedAt: string | null;
  logs: { week: number; dayNumber: number; completedAt: string }[];
  crewName: string | null;
};

/** Schedule, pause state and logged plan workouts of your active run. */
export const getPlanRunProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userPlanId: string }) => z.object({ userPlanId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PlanRunProgress> => {
    const { supabase, userId } = context;
    const [run, logs, crew] = await Promise.all([
      supabase.from("user_plans").select("starts_on, training_days, paused_at").eq("id", data.userPlanId).eq("user_id", userId).maybeSingle(),
      supabase.from("plan_workout_logs").select("week, day_number, completed_at").eq("user_plan_id", data.userPlanId),
      supabase.from("group_members").select("joined_at, groups!inner(name, ended_at)").is("groups.ended_at", null).eq("user_id", userId).order("joined_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (run.error) throw new Error(run.error.message);
    // One row per plan day (crew copies share a day).
    const seen = new Set<string>();
    const uniq = (logs.data ?? []).filter((l) => {
      const k = `${l.week}:${l.day_number}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return {
      startsOn: run.data?.starts_on ?? null,
      trainingDays: run.data?.training_days ?? null,
      pausedAt: run.data?.paused_at ?? null,
      logs: uniq.map((l) => ({ week: l.week, dayNumber: l.day_number, completedAt: l.completed_at })),
      crewName: crew.data ? (crew.data.groups as unknown as { name: string }).name : null,
    };
  });

/** Start date and training days (also clears a pause, since you just chose to go). */
export const setPlanSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userPlanId: string; trainingDays: number[]; startsOn?: string }) =>
    z.object({
      userPlanId: z.string().uuid(),
      trainingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const patch: { training_days: number[]; updated_at: string; starts_on?: string; paused_at?: null } = {
      training_days: [...new Set(data.trainingDays)].sort(),
      updated_at: new Date().toISOString(),
    };
    if (data.startsOn) {
      patch.starts_on = data.startsOn;
      patch.paused_at = null;
    }
    const { error } = await context.supabase.from("user_plans").update(patch).eq("id", data.userPlanId).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPlanPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userPlanId: string; paused: boolean }) => z.object({ userPlanId: z.string().uuid(), paused: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_plans")
      .update({ paused_at: data.paused ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq("id", data.userPlanId).eq("user_id", context.userId).eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const planInviteText = (actorName: string, planName: string) => `${firstName(actorName)} started ${planName}. Want to do it together?`;

/** Invite your crew (new-version crewmates not on the plan) after starting it. */
export const inviteCrewToPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planId: string; groupId: string }) => z.object({ planId: z.string().uuid(), groupId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.rpc("invite_crew_to_plan", { _plan_id: data.planId, _group_id: data.groupId });
    if (error) throw new Error(error.message);
    const invites = (rows ?? []) as { id: string; recipient_id: string }[];
    if (!invites.length) return { invited: 0 };
    try {
      const [{ data: plan }, { data: me }] = await Promise.all([
        supabase.from("plans").select("slug, name").eq("id", data.planId).maybeSingle(),
        supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
      ]);
      const { notifyUsers } = await import("./notify.server");
      for (const invite of invites) {
        await notifyUsers([invite.recipient_id], {
          title: "Pactara",
          body: planInviteText(me?.name ?? "", plan?.name ?? "a plan"),
          url: `/plans/${plan?.slug ?? ""}`,
          newUrl: activityOpenUrl({ kind: "plan_invite", requestId: invite.id }),
          actorUserId: userId,
        }, "group_activity_enabled");
      }
    } catch (e) {
      console.warn("[plans] invite push failed", e instanceof Error ? e.message : "Unknown error");
    }
    return { invited: invites.length };
  });
