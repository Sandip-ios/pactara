import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { firstNameOf, type ShareCrew } from "@/lib/workout-share";
import { crewsSentPlan, isPlanSlug, planShareUrl, planSharePushText, type PublicPlan } from "@/lib/plan-share";

const slugInput = (input: { slug: string }) => {
  const slug = String(input?.slug ?? "");
  if (!isPlanSlug(slug)) throw new Error("Unknown plan");
  return { slug };
};

/**
 * The Share panel for a plan: your crews (most recent chat first), the ones
 * that already got this plan from you, and your link for it (made once per
 * plan, so the share sheet opens straight from the tap).
 */
export const getPlanSharePanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(slugInput)
  .handler(async ({ context, data }): Promise<{ crews: ShareCrew[]; sentGroupIds: string[]; url: string }> => {
    const { supabase, userId } = context;
    const { loadShareCrews } = await import("@/lib/share-crews.server");
    const { ensurePlanShareCode } = await import("@/lib/shared-plans.server");
    const [crews, code, { data: sent }] = await Promise.all([
      loadShareCrews(supabase as SupabaseClient, userId),
      ensurePlanShareCode(supabase as SupabaseClient, userId, data.slug).catch((e) => {
        console.warn("[plan-share] link code failed", e);
        return null;
      }),
      supabase.from("group_messages").select("group_id, shared_plan_slug").eq("user_id", userId).eq("shared_plan_slug", data.slug),
    ]);
    return {
      crews,
      sentGroupIds: crewsSentPlan(
        (sent ?? []).map((m) => ({ groupId: m.group_id as string, slug: (m.shared_plan_slug as string | null) ?? null })),
        data.slug,
      ),
      url: planShareUrl(data.slug, code),
    };
  });

/** Posts the plan into a crew's chat as a plan card. Sending it again does nothing. */
export const sendPlanToCrew = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string; groupId: string }) => ({ ...slugInput(input), groupId: String(input?.groupId ?? "") }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase.from("plans").select("name").eq("slug", data.slug).eq("is_published", true).maybeSingle();
    if (!plan) throw new Error("That plan isn't available");
    const { data: already } = await supabase
      .from("group_messages")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .eq("shared_plan_slug", data.slug)
      .limit(1)
      .maybeSingle();
    if (already) return { groupId: data.groupId, already: true };
    // Membership and a published plan are checked by the message rules.
    const { error } = await supabase
      .from("group_messages")
      .insert({ group_id: data.groupId, user_id: userId, body: "", shared_plan_slug: data.slug });
    if (error) {
      if (error.code === "23505") return { groupId: data.groupId, already: true };
      throw new Error(error.message);
    }
    try {
      const { notifyGroupActivity, displayName } = await import("@/lib/notify.server");
      const full = await displayName(userId);
      await notifyGroupActivity(data.groupId, userId, {
        title: full,
        body: planSharePushText(firstNameOf(full), plan.name as string),
        url: `/chat/${data.groupId}`,
      });
    } catch (err) {
      console.warn("[plan-share] chat push failed", err);
    }
    return { groupId: data.groupId, already: false };
  });

/** Public: what a /p/ link shows (works signed out; used for link previews too). */
export const getPublicPlan = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; from?: string | null }) => ({
    slug: String(input?.slug ?? ""),
    from: typeof input?.from === "string" ? input.from : null,
  }))
  .handler(async ({ data }): Promise<PublicPlan | null> => {
    if (!isPlanSlug(data.slug)) return null;
    const { loadPublicPlan } = await import("@/lib/shared-plans.server");
    return loadPublicPlan(data.slug, data.from);
  });
