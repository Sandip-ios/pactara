import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localDateFor } from "@/lib/daily-posts.functions";
import { daysShownUp, isPactDone, longestCrewRun, newPactPush, pactLastDay } from "@/lib/pact-cycle";

const groupInput = z.object({ groupId: z.string().uuid() });

export type PactStatus = {
  viewerId: string;
  ownerId: string;
  isOwner: boolean;
  today: string;
  start: string;
  duration: number;
  daysPerWeek: number;
  done: boolean;
  /** Days shown up per member in the current pact. */
  shown: Record<string, number>;
  together: number;
  longest: number;
  doneSeen: boolean;
  previous: { start: string; duration: number; myShown: number | null } | null;
  bannerSeen: boolean;
};

export const getPactStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => groupInput.parse(input))
  .handler(async ({ data, context }): Promise<PactStatus | null> => {
    const { supabase, userId } = context;
    const [{ data: g }, { data: profile }, { data: members }] = await Promise.all([
      supabase.from("groups").select("id, owner_id, start_date, created_at, duration_days, days_per_week, frequency, previous_start_date, previous_duration_days").is("ended_at", null).eq("id", data.groupId).maybeSingle(),
      supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
      supabase.from("group_members").select("user_id, joined_at").eq("group_id", data.groupId),
    ]);
    if (!g || !(members ?? []).some((m) => m.user_id === userId)) return null;
    const tz = (profile?.timezone as string | null) ?? "UTC";
    const today = localDateFor(tz);
    const start = (g.start_date as string | null) ?? localDateFor(tz, new Date(g.created_at as string));
    const duration = (g.duration_days as number | null) ?? 30;
    const prevStart = g.previous_start_date as string | null;
    const prevDuration = (g.previous_duration_days as number | null) ?? null;
    const from = prevStart && prevStart < start ? prevStart : start;
    const [{ data: rows }, { data: seen }] = await Promise.all([
      supabase.from("check_ins").select("user_id, checkin_date").eq("group_id", data.groupId).gte("checkin_date", from).lte("checkin_date", pactLastDay(start, duration)).limit(5000),
      supabase.from("pact_member_seen").select("pact_start, kind").eq("group_id", data.groupId).eq("user_id", userId),
    ]);
    const byUser = new Map<string, Set<string>>();
    for (const r of rows ?? []) {
      const set = byUser.get(r.user_id as string) ?? new Set<string>();
      set.add(r.checkin_date as string);
      byUser.set(r.user_id as string, set);
    }
    const shown: Record<string, number> = {};
    let together = 0;
    for (const m of members ?? []) {
      const n = daysShownUp(byUser.get(m.user_id as string) ?? [], start, duration);
      shown[m.user_id as string] = n;
      together += n;
    }
    const longest = longestCrewRun(
      (members ?? []).map((m) => ({ joinedOn: String(m.joined_at).slice(0, 10), days: byUser.get(m.user_id as string) ?? new Set<string>() })),
      start,
      duration,
    );
    const has = (kind: string, at: string) => (seen ?? []).some((s) => s.kind === kind && s.pact_start === at);
    const mine = (members ?? []).find((m) => m.user_id === userId);
    const wasIn = prevStart && prevDuration ? String(mine?.joined_at).slice(0, 10) <= pactLastDay(prevStart, prevDuration) : false;
    return {
      viewerId: userId,
      ownerId: g.owner_id as string,
      isOwner: g.owner_id === userId,
      today,
      start,
      duration,
      daysPerWeek: g.frequency === "daily" ? 7 : Math.max(1, Math.min(7, (g.days_per_week as number | null) ?? 7)),
      done: isPactDone(today, start, duration),
      shown,
      together,
      longest,
      doneSeen: has("done", start),
      previous: prevStart && prevDuration ? { start: prevStart, duration: prevDuration, myShown: wasIn ? daysShownUp(byUser.get(userId) ?? [], prevStart, prevDuration) : null } : null,
      bannerSeen: has("banner", start),
    };
  });

export const markPactSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => groupInput.extend({ pactStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kind: z.enum(["done", "banner"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("pact_member_seen")
      .upsert({ user_id: context.userId, group_id: data.groupId, pact_start: data.pactStart, kind: data.kind }, { onConflict: "user_id,group_id,pact_start,kind", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const startNextPact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => groupInput.extend({ durationDays: z.union([z.literal(30), z.literal(60), z.literal(90)]), daysPerWeek: z.number().int().min(1).max(7) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
    const start = localDateFor((profile?.timezone as string | null) ?? "UTC");
    const { error } = await supabase.rpc("start_next_pact", { _group_id: data.groupId, _duration_days: data.durationDays, _days_per_week: data.daysPerWeek, _start: start });
    if (error) throw new Error(error.message);
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { filterOptedIn, pushToUsers } = await import("@/lib/notify.server");
      const [{ data: crew }, { data: members }] = await Promise.all([
        supabaseAdmin.from("groups").select("name").eq("id", data.groupId).is("ended_at", null).maybeSingle(),
        supabaseAdmin.from("group_members").select("user_id").eq("group_id", data.groupId),
      ]);
      const others = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== userId);
      if (crew && others.length) {
        const users = await filterOptedIn(others, "group_activity_enabled");
        await pushToUsers(users, { title: "Pactara", body: newPactPush(crew.name as string, data.durationDays), url: `/crews/${data.groupId}`, actorUserId: userId, crewIds: [data.groupId] });
      }
    } catch (e) {
      console.warn("[pact] new pact push failed", e);
    }
    return { start };
  });
