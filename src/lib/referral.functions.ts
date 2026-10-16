import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DAY = 86400000;

export const getCreatorStats = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ key: z.string().min(10).max(80), days: z.number().int().min(1).max(365) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: partner } = await supabaseAdmin
      .from("referral_partners")
      .select("id, name, slug, payout_per_member_cents, instagram_followers, tiktok_followers, short_link")
      .eq("dashboard_key", data.key)
      .maybeSingle();
    if (!partner) throw new Error("Invalid link");

    const since = new Date(Date.now() - data.days * DAY);
    const [{ data: events }, { data: installs }] = await Promise.all([
      supabaseAdmin.from("referral_events").select("event, created_at").eq("partner_id", partner.id).gte("created_at", since.toISOString()).limit(50000),
      supabaseAdmin.from("referral_installs").select("user_id, created_at, linked_at").eq("partner_id", partner.id),
    ]);
    const userIds = (installs ?? []).map((i) => i.user_id).filter((x): x is string => !!x);
    const [{ data: profiles }, { data: checks }, { data: subs }] = userIds.length
      ? await Promise.all([
          supabaseAdmin.from("profiles").select("id, name").in("id", userIds),
          supabaseAdmin.from("check_ins").select("user_id").in("user_id", userIds),
          supabaseAdmin.from("subscriptions").select("user_id, is_active, store").in("user_id", userIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
    const checked = new Set((checks ?? []).map((c) => c.user_id));
    const paying = new Set((subs ?? []).filter((s) => s.is_active && s.store !== "manual").map((s) => s.user_id));
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, (p.name ?? "").split(" ")[0] || "New member"]));

    const inRange = (iso: string | null) => !!iso && new Date(iso) >= since;
    const ev = events ?? [];
    const inst = installs ?? [];
    const signups = inst.filter((i) => i.user_id && inRange(i.linked_at));

    const series: { date: string; taps: number; signups: number }[] = [];
    for (let i = data.days - 1; i >= 0; i--) {
      series.push({ date: new Date(Date.now() - i * DAY).toISOString().slice(0, 10), taps: 0, signups: 0 });
    }
    const idx = new Map(series.map((s, i) => [s.date, i]));
    for (const e of ev) if (e.event === "tap") { const i = idx.get(e.created_at.slice(0, 10)); if (i !== undefined) series[i].taps++; }
    for (const s of signups) { const i = idx.get(s.linked_at!.slice(0, 10)); if (i !== undefined) series[i].signups++; }

    const allPaying = userIds.filter((u) => paying.has(u)).length;
    return {
      name: partner.name,
      link: (partner.short_link ?? `https://pactara.lovable.app/r/${partner.slug}`).replace(/^https?:\/\//, ""),
      totals: {
        taps: ev.filter((e) => e.event === "tap").length,
        store: ev.filter((e) => e.event === "store").length,
        installs: inst.filter((i) => inRange(i.created_at)).length,
        signups: signups.length,
        active: signups.filter((s) => checked.has(s.user_id!)).length,
        paying: signups.filter((s) => paying.has(s.user_id!)).length,
      },
      lifetime: { members: userIds.length, paying: allPaying, earnedCents: allPaying * partner.payout_per_member_cents },
      payoutCents: partner.payout_per_member_cents,
      followers: { instagram: partner.instagram_followers, tiktok: partner.tiktok_followers },
      series,
      recent: inst
        .filter((i) => i.user_id)
        .sort((a, b) => (b.linked_at ?? "").localeCompare(a.linked_at ?? ""))
        .slice(0, 7)
        .map((i) => ({
          name: nameOf.get(i.user_id!) ?? "New member",
          joined: i.linked_at,
          status: paying.has(i.user_id!) ? "Paying" : checked.has(i.user_id!) ? "Checking in" : "Signed up",
        })),
    };
  });

export const saveCreatorFollowers = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ key: z.string().min(10).max(80), instagram: z.number().int().min(0).max(1e9), tiktok: z.number().int().min(0).max(1e9) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("referral_partners").update({ instagram_followers: data.instagram, tiktok_followers: data.tiktok }).eq("dashboard_key", data.key);
    if (error) throw new Error("Could not save");
    return { ok: true };
  });
