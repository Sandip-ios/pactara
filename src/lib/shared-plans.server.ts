import type { SupabaseClient } from "@supabase/supabase-js";
import { firstNameOf, makeShareCode } from "@/lib/workout-share";
import { isPlanShareCode, isPlanSlug, weekOnePreview, type PublicPlan } from "@/lib/plan-share";

/**
 * The public /p/<slug> page. Plans are only readable signed in, so this uses
 * the service client and returns public plan fields plus, when the link
 * carries a valid share code, the sharer's first name. Nothing else.
 */
export async function loadPublicPlan(slug: string, from: string | null): Promise<PublicPlan | null> {
  if (!isPlanSlug(slug)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id, slug, name, level, weeks, days_per_week, minutes, summary, cover_url")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!plan) return null;
  const [{ data: days }, sharer] = await Promise.all([
    supabaseAdmin.from("plan_days").select("day_number, week_number, title").eq("plan_id", plan.id),
    (async () => {
      if (!from || !isPlanShareCode(from)) return null;
      const { data: link } = await supabaseAdmin.from("shared_plans").select("owner_id, plan_slug").eq("code", from).maybeSingle();
      if (!link || link.plan_slug !== slug) return null;
      const { data: prof } = await supabaseAdmin.from("profiles").select("name").eq("id", link.owner_id).maybeSingle();
      const name = ((prof?.name as string | undefined) ?? "").trim();
      return name ? firstNameOf(name) : null;
    })(),
  ]);
  return {
    slug: plan.slug as string,
    name: plan.name as string,
    level: plan.level as string,
    weeks: plan.weeks as number,
    daysPerWeek: plan.days_per_week as number,
    minutes: plan.minutes as string,
    summary: plan.summary as string,
    coverUrl: (plan.cover_url as string | null) ?? null,
    weekOne: weekOnePreview(
      (days ?? []).map((d) => ({ dayNumber: d.day_number as number, weekNumber: (d.week_number as number | null) ?? null, title: d.title as string })),
    ),
    sharerFirstName: sharer,
  };
}

/** The member's own share code for a plan (one per member per plan, made once). */
export async function ensurePlanShareCode(supabase: SupabaseClient, userId: string, slug: string): Promise<string> {
  const read = async () => {
    const { data } = await supabase.from("shared_plans").select("code").eq("owner_id", userId).eq("plan_slug", slug).maybeSingle();
    return (data?.code as string | undefined) ?? null;
  };
  const existing = await read();
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeShareCode();
    const { error } = await supabase.from("shared_plans").insert({ code, owner_id: userId, plan_slug: slug });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
    // Made from another tap a moment ago, or a code clash: read again / retry.
    const raced = await read();
    if (raced) return raced;
  }
  throw new Error("Couldn't make a link");
}
