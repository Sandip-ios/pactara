import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signAvatarThumbs } from "@/lib/media-urls";

export type PlanCrewmate = { firstName: string; crewName: string; avatarUrl: string | null };

/** One crewmate currently on this plan, with a crew you share (new Discover "YOUR PLAN" card). */
export const getPlanCrewmate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planId: string }) => ({ planId: String(input?.planId ?? "") }))
  .handler(async ({ data, context }): Promise<PlanCrewmate | null> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.rpc("crew_on_plan", { _plan_id: data.planId });
    if (error) return null;
    const active = ((rows ?? []) as { user_id: string; status: string }[]).filter((r) => r.status === "active").map((r) => r.user_id);
    if (active.length === 0) return null;
    const { data: mine } = await supabase
      .from("group_members")
      .select("group_id, groups!inner(name, ended_at)")
      .is("groups.ended_at", null)
      .eq("user_id", userId);
    const myGroups = new Map((mine ?? []).map((m) => [m.group_id, (m.groups as unknown as { name: string }).name]));
    if (myGroups.size === 0) return null;
    const { data: theirs } = await supabase
      .from("group_members")
      .select("user_id, group_id")
      .in("user_id", active)
      .in("group_id", [...myGroups.keys()]);
    const pairs = (theirs ?? []).sort((a, b) => a.user_id.localeCompare(b.user_id));
    const first = pairs[0];
    if (!first) return null;
    const { data: prof } = await supabase.from("profiles").select("name, avatar_url").eq("id", first.user_id).maybeSingle();
    const urls = prof?.avatar_url ? await signAvatarThumbs(supabase as SupabaseClient, [prof.avatar_url], 60) : new Map();
    return {
      firstName: (prof?.name ?? "").trim().split(" ")[0] || "Member",
      crewName: myGroups.get(first.group_id) ?? "your crew",
      avatarUrl: prof?.avatar_url ? urls.get(prof.avatar_url) ?? null : null,
    };
  });
