// Server-only helpers for accountability partner matching.
import { filterOptedIn, pushToUsers } from "@/lib/notify.server";

export const PARTNER_DAYS = 90;
const ACCEPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const INACTIVE_DAYS = 4;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Records an internal analytics event. Never includes goal text. */
export async function trackPartnerEvent(
  userId: string,
  event: string,
  properties: Record<string, unknown> = {},
) {
  try {
    const db = await admin();
    await db.from("app_events").insert({
      user_id: userId,
      event,
      platform: "server",
      properties: properties as never,
    });
  } catch {
    // analytics must never break the flow
  }
}

export async function firstName(userId: string): Promise<string> {
  const db = await admin();
  const { data } = await db.from("profiles").select("name").eq("id", userId).maybeSingle();
  return ((data?.name as string | undefined) ?? "").trim().split(/\s+/)[0] || "Your partner";
}

/** The user's most recently written personal goal, from any membership. */
export async function latestGoal(userId: string): Promise<string | null> {
  const db = await admin();
  const { data: q } = await db.from("partner_queue").select("goal").eq("user_id", userId).maybeSingle();
  if (q?.goal) return q.goal as string;
  const { data } = await db
    .from("group_members")
    .select("personal_goal, personal_goal_set_at")
    .eq("user_id", userId)
    .not("personal_goal", "is", null)
    .order("personal_goal_set_at", { ascending: false, nullsFirst: false })
    .limit(1);
  return ((data ?? [])[0]?.personal_goal as string | undefined) ?? null;
}

/** Internal reliability signal: recent check-ins, pacts made, abandoned matches. */
export async function reliabilityScore(userId: string): Promise<number> {
  const db = await admin();
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString().slice(0, 10);
  const [{ count: checkins }, { count: expired }] = await Promise.all([
    db.from("check_ins").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("checkin_date", since),
    db
      .from("partnerships")
      .select("id", { count: "exact", head: true })
      .or(`and(user_1_id.eq.${userId},user_1_accepted_at.is.null),and(user_2_id.eq.${userId},user_2_accepted_at.is.null)`)
      .eq("status", "expired"),
  ]);
  return Math.max(0, (checkins ?? 0) * 2 + 5 - (expired ?? 0) * 3);
}

export function bucket(score: number) {
  return score >= 20 ? "high" : score >= 8 ? "medium" : "low";
}

/**
 * Releases matches nobody finished accepting within the window. Whoever
 * accepted goes back into the pool; whoever didn't is quietly removed.
 */
export async function expireStaleMatches() {
  const db = await admin();
  const { data: stale } = await db
    .from("partnerships")
    .select("id, user_1_id, user_2_id, user_1_accepted_at, user_2_accepted_at, matched_at")
    .eq("status", "pending_acceptance")
    .lt("expires_at", new Date().toISOString());
  for (const p of stale ?? []) {
    const { data: claimed } = await db
      .from("partnerships")
      .update({ status: "expired", ended_at: new Date().toISOString(), ended_reason: "acceptance_timeout" })
      .eq("id", p.id)
      .eq("status", "pending_acceptance")
      .select("id");
    if (!claimed?.length) continue;
    const pairs: Array<[string, string | null]> = [
      [p.user_1_id, p.user_1_accepted_at],
      [p.user_2_id, p.user_2_accepted_at],
    ];
    for (const [uid, accepted] of pairs) {
      const { data: row } = await db.from("partner_queue").select("released_count").eq("user_id", uid).maybeSingle();
      await db
        .from("partner_queue")
        .update({
          status: accepted ? "waiting" : "removed",
          matched_at: null,
          released_count: ((row?.released_count as number | undefined) ?? 0) + (accepted ? 1 : 0),
          ...(accepted ? { recent_activity_at: new Date().toISOString() } : {}),
        })
        .eq("user_id", uid);
      await trackPartnerEvent(uid, "partner_match_declined_or_expired", {
        partnership_id: p.id,
        accepted: Boolean(accepted),
      });
    }
  }
}

export async function currentPartnership(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("partnerships")
    .select("*")
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .in("status", ["pending_acceptance", "active"])
    .order("created_at", { ascending: false })
    .limit(1);
  return (data ?? [])[0] ?? null;
}

/** Joins the pool, or pairs instantly with the best person already waiting. */
export async function searchForPartner(userId: string, opts: { goal?: string | null; soloGroupId?: string | null }) {
  const db = await admin();
  await expireStaleMatches();

  const existing = await currentPartnership(userId);
  if (existing) return { matched: true, partnershipId: existing.id as string, instant: false };

  const now = new Date();
  const score = await reliabilityScore(userId);
  const goal = opts.goal ?? (await latestGoal(userId));

  // Previous partners are skipped so the same two people aren't re-paired.
  const { data: history } = await db
    .from("partnerships")
    .select("user_1_id, user_2_id")
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`);
  const avoid = new Set<string>([userId]);
  for (const h of history ?? []) {
    avoid.add(h.user_1_id as string);
    avoid.add(h.user_2_id as string);
  }

  const { data: candidates } = await db
    .from("partner_queue")
    .select("id, user_id, entered_at, reliability_score_internal")
    .eq("status", "waiting")
    .gte("recent_activity_at", new Date(now.getTime() - ACTIVE_WINDOW_MS).toISOString())
    .order("reliability_score_internal", { ascending: false })
    .order("entered_at", { ascending: true })
    .limit(25);

  for (const c of candidates ?? []) {
    if (avoid.has(c.user_id as string)) continue;
    if (await currentPartnership(c.user_id as string)) continue;
    const { data: claimed } = await db
      .from("partner_queue")
      .update({ status: "matched", matched_at: now.toISOString() })
      .eq("id", c.id)
      .eq("status", "waiting")
      .select("id");
    if (!claimed?.length) continue;

    const { data: p, error } = await db
      .from("partnerships")
      .insert({
        user_1_id: c.user_id,
        user_2_id: userId,
        status: "pending_acceptance",
        duration_days: PARTNER_DAYS,
        expires_at: new Date(now.getTime() + ACCEPT_WINDOW_MS).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await db.from("partner_queue").upsert(
      {
        user_id: userId,
        status: "matched",
        goal,
        solo_group_id: opts.soloGroupId ?? null,
        matched_at: now.toISOString(),
        recent_activity_at: now.toISOString(),
        reliability_score_internal: score,
      },
      { onConflict: "user_id" },
    );

    const waitMs = now.getTime() - new Date(c.entered_at as string).getTime();
    await trackPartnerEvent(userId, "partner_match_found", { partnership_id: p.id, is_instant_match: true, queue_wait_time: 0 });
    await trackPartnerEvent(c.user_id as string, "partner_match_found", {
      partnership_id: p.id,
      is_instant_match: false,
      queue_wait_time: Math.round(waitMs / 1000),
      days_until_match: Math.floor(waitMs / 86400000),
    });

    const recipients = await filterOptedIn([c.user_id as string], "nudges_enabled");
    await pushToUsers(recipients, {
      title: "You've got an accountability partner 🔥",
      body: "Someone's ready to show up with you.",
      url: "/partner",
    }).catch(() => undefined);

    return { matched: true, partnershipId: p.id as string, instant: true };
  }

  const { data: existingRow } = await db.from("partner_queue").select("entered_at, status").eq("user_id", userId).maybeSingle();
  await db.from("partner_queue").upsert(
    {
      user_id: userId,
      status: "waiting",
      goal,
      ...(opts.soloGroupId ? { solo_group_id: opts.soloGroupId } : {}),
      entered_at: existingRow?.status === "waiting" ? (existingRow.entered_at as string) : now.toISOString(),
      matched_at: null,
      recent_activity_at: now.toISOString(),
      reliability_score_internal: score,
    },
    { onConflict: "user_id" },
  );
  await trackPartnerEvent(userId, "partner_search_queued", { user_reliability_bucket_internal: bucket(score) });
  return { matched: false, partnershipId: null, instant: false };
}
