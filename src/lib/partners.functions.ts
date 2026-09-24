import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PartnerPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  goal: string | null;
};

export type PartnerState = {
  status: "none" | "waiting" | "pending" | "active";
  released: boolean;
  myGoal: string | null;
  soloGroupId: string | null;
  partnership: null | {
    id: string;
    partner: PartnerPerson;
    iAccepted: boolean;
    partnerAccepted: boolean;
    groupId: string | null;
    durationDays: number;
    partnerInactive: boolean;
  };
};

async function person(userId: string): Promise<PartnerPerson> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { latestGoal } = await import("./partners.server");
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("id, name, avatar_color, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  let url: string | null = null;
  if (p?.avatar_url) {
    const { data: s } = await supabaseAdmin.storage.from("avatars").createSignedUrl(p.avatar_url, 3600);
    url = s?.signedUrl ?? null;
  }
  return {
    id: userId,
    name: ((p?.name as string | undefined) ?? "").trim().split(/\s+/)[0] || "Your partner",
    avatarUrl: url,
    avatarColor: (p?.avatar_color as string | undefined) ?? "#7C3AED",
    goal: await latestGoal(userId),
  };
}

export const getPartnerState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PartnerState> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const srv = await import("./partners.server");
    await srv.expireStaleMatches();

    const [{ data: queue }, current, myGoal] = await Promise.all([
      supabaseAdmin.from("partner_queue").select("*").eq("user_id", userId).maybeSingle(),
      srv.currentPartnership(userId),
      srv.latestGoal(userId),
    ]);

    const base = {
      myGoal,
      soloGroupId: (queue?.solo_group_id as string | null) ?? null,
      released: ((queue?.released_count as number | undefined) ?? 0) > 0,
    };

    if (!current) {
      return { ...base, status: queue?.status === "waiting" ? "waiting" : "none", partnership: null };
    }

    const iAmOne = current.user_1_id === userId;
    const partnerId = (iAmOne ? current.user_2_id : current.user_1_id) as string;
    const partner = await person(partnerId);

    let partnerInactive = false;
    if (current.status === "active" && current.started_at) {
      const since = new Date(Date.now() - srv.INACTIVE_DAYS * 86400000);
      if (new Date(current.started_at as string) < since) {
        const { count } = await supabaseAdmin
          .from("check_ins")
          .select("id", { count: "exact", head: true })
          .eq("user_id", partnerId)
          .gte("created_at", since.toISOString());
        partnerInactive = (count ?? 0) === 0;
        if (partnerInactive) {
          await srv.trackPartnerEvent(userId, "partner_inactive_detected", { partnership_id: current.id });
        }
      }
    }

    return {
      ...base,
      status: current.status === "active" ? "active" : "pending",
      partnership: {
        id: current.id as string,
        partner,
        iAccepted: Boolean(iAmOne ? current.user_1_accepted_at : current.user_2_accepted_at),
        partnerAccepted: Boolean(iAmOne ? current.user_2_accepted_at : current.user_1_accepted_at),
        groupId: (current.group_id as string | null) ?? null,
        durationDays: (current.duration_days as number) ?? 90,
        partnerInactive,
      },
    };
  });

export const findPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { soloGroupId?: string | null } | undefined) => ({
    soloGroupId:
      typeof input?.soloGroupId === "string" && /^[0-9a-f-]{36}$/i.test(input.soloGroupId) ? input.soloGroupId : null,
  }))
  .handler(async ({ data, context }) => {
    const srv = await import("./partners.server");
    await srv.trackPartnerEvent(context.userId, "partner_search_started");
    return srv.searchForPartner(context.userId, { soloGroupId: data.soloGroupId });
  });

export const acceptPartnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { partnershipId: string }) => {
    const id = String(input?.partnershipId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid partnership");
    return { partnershipId: id };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const srv = await import("./partners.server");
    const { filterOptedIn, pushToUsers } = await import("./notify.server");

    const { data: p } = await supabaseAdmin.from("partnerships").select("*").eq("id", data.partnershipId).maybeSingle();
    if (!p || (p.user_1_id !== userId && p.user_2_id !== userId)) throw new Error("Partnership not found");
    if (p.status === "active") return { active: true, groupId: p.group_id as string | null };
    if (p.status !== "pending_acceptance") throw new Error("This match is no longer available");

    const iAmOne = p.user_1_id === userId;
    const now = new Date().toISOString();
    const col = iAmOne ? "user_1_accepted_at" : "user_2_accepted_at";
    const { data: updated } = await supabaseAdmin
      .from("partnerships")
      .update({ [col]: now } as never)
      .eq("id", p.id)
      .select("*")
      .single();
    await srv.trackPartnerEvent(userId, "partner_match_accepted", {
      partnership_id: p.id,
      acceptance_time: Math.round((Date.now() - new Date(p.matched_at as string).getTime()) / 1000),
    });

    if (!updated?.user_1_accepted_at || !updated?.user_2_accepted_at) {
      return { active: false, groupId: null };
    }

    // Both in: claim activation so only one request builds the group.
    const { data: claimed } = await supabaseAdmin
      .from("partnerships")
      .update({ status: "active", started_at: now })
      .eq("id", p.id)
      .eq("status", "pending_acceptance")
      .select("id");
    if (!claimed?.length) {
      const { data: again } = await supabaseAdmin.from("partnerships").select("group_id").eq("id", p.id).single();
      return { active: true, groupId: (again?.group_id as string | null) ?? null };
    }

    const u1 = p.user_1_id as string;
    const u2 = p.user_2_id as string;
    const [n1, n2, g1, g2] = await Promise.all([
      srv.firstName(u1),
      srv.firstName(u2),
      srv.latestGoal(u1),
      srv.latestGoal(u2),
    ]);
    const { data: group, error: gErr } = await supabaseAdmin
      .from("groups")
      .insert({
        name: `${n1} + ${n2}`,
        emoji: "🤝",
        owner_id: u1,
        duration_days: srv.PARTNER_DAYS,
        frequency: "daily",
        days_per_week: 7,
        start_date: now.slice(0, 10),
        kind: "partner",
      })
      .select("id")
      .single();
    if (gErr) throw new Error(gErr.message);
    // Each person keeps their own goal — nothing is shared or copied across.
    const { error: mErr } = await supabaseAdmin.from("group_members").insert([
      { group_id: group.id, user_id: u1, personal_goal: g1, personal_goal_set_at: g1 ? now : null },
      { group_id: group.id, user_id: u2, personal_goal: g2, personal_goal_set_at: g2 ? now : null },
    ]);
    if (mErr) throw new Error(mErr.message);
    await supabaseAdmin.from("partnerships").update({ group_id: group.id }).eq("id", p.id);

    for (const uid of [u1, u2]) {
      await srv.trackPartnerEvent(uid, "partner_match_both_accepted", { partnership_id: p.id });
      await srv.trackPartnerEvent(uid, "partner_relationship_started", { partnership_id: p.id });
    }

    const other = iAmOne ? u2 : u1;
    const myName = iAmOne ? n1 : n2;
    const recipients = await filterOptedIn([other], "nudges_enabled");
    await pushToUsers(recipients, {
      title: `${myName} is in 🔥`,
      body: `Your ${srv.PARTNER_DAYS}-day accountability partnership is ready.`,
      url: `/pact/${group.id}`,
    }).catch(() => undefined);

    return { active: true, groupId: group.id as string };
  });

/** Ends the current partnership and puts the user back in line. History stays. */
export const requestNewPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const srv = await import("./partners.server");
    const current = await srv.currentPartnership(userId);
    if (current) {
      await supabaseAdmin
        .from("partnerships")
        .update({ status: "ended", ended_at: new Date().toISOString(), ended_by: userId, ended_reason: "rematch" })
        .eq("id", current.id);
      const other = (current.user_1_id === userId ? current.user_2_id : current.user_1_id) as string;
      // The other person goes back in line too, without being told why.
      await supabaseAdmin.from("partner_queue").update({ status: "waiting", matched_at: null }).eq("user_id", other);
      const age = current.started_at
        ? Math.floor((Date.now() - new Date(current.started_at as string).getTime()) / 86400000)
        : 0;
      await srv.trackPartnerEvent(userId, "partner_relationship_ended", { partnership_id: current.id, partnership_age: age });
    }
    await srv.trackPartnerEvent(userId, "partner_rematch_requested", { partnership_id: current?.id ?? null });
    const res = await srv.searchForPartner(userId, {});
    if (res.matched) await srv.trackPartnerEvent(userId, "partner_rematch_completed", { partnership_id: res.partnershipId });
    return res;
  });

/** Client-side analytics for partner screens (no personal content). */
export const trackPartnerScreen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event: string; partnershipId?: string | null }) => {
    const allowed = [
      "accountability_method_viewed",
      "accountability_method_selected",
      "bring_my_people_selected",
      "find_partner_selected",
      "partner_match_viewed",
      "partner_pact_started",
      "partner_pact_completed",
    ];
    if (!allowed.includes(input?.event)) throw new Error("Invalid event");
    return { event: input.event, partnershipId: input.partnershipId ?? null };
  })
  .handler(async ({ data, context }) => {
    const srv = await import("./partners.server");
    await srv.trackPartnerEvent(context.userId, data.event, { partnership_id: data.partnershipId });
    return { ok: true };
  });
