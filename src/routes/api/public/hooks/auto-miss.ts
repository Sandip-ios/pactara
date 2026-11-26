import { crewIsActive } from "@/lib/crew-lifecycle";
import { createFileRoute } from "@tanstack/react-router";
import { closedDayFor, key, planAutoMiss, type PlanMembership, type PlanPost } from "@/lib/auto-miss-plan";

/**
 * Hourly job: for every membership, once the member's local day has closed
 * with no check-in for that group, use one of the group's weekly rest days
 * automatically (Mon–Sun, member's timezone); only when none are left is the
 * day marked missed. All reads and writes are batched across memberships.
 * (The daily commitment was retired, so nothing is marked "missed commitment".)
 *
 * Authenticated with the Supabase anon `apikey` header (Lovable's cron pattern).
 */
export const Route = createFileRoute("/api/public/hooks/auto-miss")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Partner-match reminder: one push to whoever hasn't accepted yet when
        // a pending match has 3–4 hours left (hourly cron → sent once).
        try {
          const now = Date.now();
          const { data: pending } = await supabaseAdmin
            .from("partnerships")
            .select("user_1_id, user_2_id, user_1_accepted_at, user_2_accepted_at")
            .eq("status", "pending_acceptance")
            .gt("expires_at", new Date(now + 3 * 3600_000).toISOString())
            .lte("expires_at", new Date(now + 4 * 3600_000).toISOString());
          const { pushToUsers } = await import("@/lib/notify.server");
          for (const p of pending ?? []) {
            const waiting = !p.user_1_accepted_at ? p.user_1_id : !p.user_2_accepted_at ? p.user_2_id : null;
            if (!waiting) continue;
            await pushToUsers([waiting], {
              title: "Your partner match expires soon ⏳",
              body: "Your partner is waiting. Tap to accept and sign your 90-day pact before it expires.",
              url: "/partner",
            }).catch(() => undefined);
          }
        } catch (err) {
          console.warn("[auto-miss] partner reminder failed", err);
        }

        // Find every membership (user × group). Missed posts are per-group.
        const { data: memberships, error: mErr } = await supabaseAdmin
          .from("group_members")
          .select("user_id, group_id, joined_at");
        if (mErr) {
          return Response.json({ error: mErr.message }, { status: 500 });
        }

        const allMemberships = memberships ?? [];
        const userIds = Array.from(new Set(allMemberships.map((m) => m.user_id)));
        if (userIds.length === 0) return Response.json({ ok: true, scanned: 0 });
        const groupIds = Array.from(new Set(allMemberships.map((m) => m.group_id)));

        const [profsRes, groupsRes] = await Promise.all([
          supabaseAdmin.from("profiles").select("id, timezone").in("id", userIds),
          supabaseAdmin.from("groups").select("id, frequency, days_per_week, ended_at").is("ended_at", null).in("id", groupIds),
        ]);
        if (profsRes.error) return Response.json({ error: profsRes.error.message }, { status: 500 });
        if (groupsRes.error) return Response.json({ error: groupsRes.error.message }, { status: 500 });

        const tzByUser = new Map<string, string>();
        for (const p of profsRes.data ?? []) tzByUser.set(p.id, p.timezone || "UTC");
        const groupById = new Map((groupsRes.data ?? []).filter(crewIsActive).map((g) => [g.id, g]));

        const now = new Date();
        const planMemberships: PlanMembership[] = [];
        let rangeStart = "9999-12-31";
        let rangeEnd = "0000-01-01";
        for (const m of allMemberships) {
          const g = groupById.get(m.group_id);
          if (!g) continue;
          const timezone = tzByUser.get(m.user_id) || "UTC";
          const { day, weekStart, weekEnd } = closedDayFor(timezone, now);
          if (weekStart < rangeStart) rangeStart = weekStart;
          if (weekEnd > rangeEnd) rangeEnd = weekEnd;
          if (day > rangeEnd) rangeEnd = day;
          planMemberships.push({
            userId: m.user_id,
            groupId: m.group_id,
            joinedAt: m.joined_at,
            timezone,
            group: { frequency: g.frequency, days_per_week: g.days_per_week },
          });
        }
        if (planMemberships.length === 0) return Response.json({ ok: true, scanned: userIds.length });

        // Load everything the plan needs up front, in pages, instead of
        // querying per membership.
        const PAGE = 1000;
        async function fetchAll<T>(
          build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
        ): Promise<T[]> {
          const out: T[] = [];
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await build(from, from + PAGE - 1);
            if (error) throw new Error(error.message);
            out.push(...(data ?? []));
            if (!data || data.length < PAGE) break;
          }
          return out;
        }

        let checkInRows: { user_id: string; group_id: string; checkin_date: string }[];
        let freezeRows: { user_id: string; group_id: string; freeze_date: string; kind: string }[];
        let postRows: { id: string; user_id: string; group_id: string; local_date: string; check_in_id: string | null; check_in_missed: boolean }[];
        try {
          [checkInRows, freezeRows, postRows] = await Promise.all([
            fetchAll((from, to) =>
              supabaseAdmin
                .from("check_ins")
                .select("user_id, group_id, checkin_date")
                .gte("checkin_date", rangeStart)
                .lte("checkin_date", rangeEnd)
                .order("id")
                .range(from, to),
            ),
            fetchAll((from, to) =>
              supabaseAdmin
                .from("streak_freezes_used")
                .select("user_id, group_id, freeze_date, kind")
                .gte("freeze_date", rangeStart)
                .lte("freeze_date", rangeEnd)
                .order("id")
                .range(from, to),
            ),
            fetchAll((from, to) =>
              supabaseAdmin
                .from("daily_posts")
                .select("id, user_id, group_id, local_date, check_in_id, check_in_missed")
                .gte("local_date", rangeStart)
                .lte("local_date", rangeEnd)
                .order("id")
                .range(from, to),
            ),
          ]);
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }

        const checkIns = new Set(checkInRows.map((r) => key(r.user_id, r.group_id, r.checkin_date)));
        const protectedDays = new Set(freezeRows.map((r) => key(r.user_id, r.group_id, r.freeze_date)));
        const restDates = new Map<string, Set<string>>();
        for (const r of freezeRows) {
          if (r.kind !== "rest") continue;
          const k = key(r.user_id, r.group_id);
          if (!restDates.has(k)) restDates.set(k, new Set());
          restDates.get(k)!.add(r.freeze_date);
        }
        const posts = new Map<string, PlanPost>(
          postRows.map((p) => [
            key(p.user_id, p.group_id, p.local_date),
            { id: p.id, checkInId: p.check_in_id, missed: p.check_in_missed },
          ]),
        );

        const plan = planAutoMiss({ memberships: planMemberships, now, checkIns, protectedDays, restDates, posts });

        // Apply in batches. Rest rows first so a day is never shown missed
        // without its rest row.
        let restDaysUsed = 0;
        let checkInMissed = 0;
        if (plan.rests.length > 0) {
          const { error } = await supabaseAdmin
            .from("streak_freezes_used")
            .upsert(plan.rests, { onConflict: "user_id,group_id,freeze_date", ignoreDuplicates: true });
          if (error) console.warn("[auto-miss] rest insert failed", error.message);
          else restDaysUsed = plan.rests.length;
        }
        if (plan.postInserts.length > 0) {
          const { error } = await supabaseAdmin
            .from("daily_posts")
            .upsert(plan.postInserts, { onConflict: "user_id,group_id,local_date", ignoreDuplicates: true });
          if (error) console.warn("[auto-miss] post insert failed", error.message);
          else checkInMissed += plan.postInserts.filter((p) => p.check_in_missed).length;
        }
        if (plan.missedIds.length > 0) {
          const { error } = await supabaseAdmin
            .from("daily_posts")
            .update({ check_in_missed: true })
            .in("id", plan.missedIds);
          if (error) console.warn("[auto-miss] missed update failed", error.message);
          else checkInMissed += plan.missedIds.length;
        }
        if (plan.unmissIds.length > 0) {
          const { error } = await supabaseAdmin
            .from("daily_posts")
            .update({ check_in_missed: false })
            .in("id", plan.unmissIds);
          if (error) console.warn("[auto-miss] rest unmiss failed", error.message);
        }

        return Response.json({
          ok: true,
          scanned: userIds.length,
          checkInMissed,
          restDaysUsed,
        });
      },
    },
  },
});
