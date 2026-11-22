import { createFileRoute } from "@tanstack/react-router";
import { localHourFor } from "@/lib/daily-posts.functions";
import { atRiskGroups, streakRiskMessage, type RiskGroupInput } from "@/lib/streak-risk-plan";

/** Local hour at which the streak-at-risk warning goes out. */
const RISK_HOUR = 21;
/** How far back to load activity when measuring the streak shown in the push. */
const LOOKBACK_DAYS = 400;
const PAGE = 1000;

/**
 * Hourly cron: at 9pm local time, warn members whose day would really be
 * missed — per group, no check-in today and no rest days left this Mon–Sun
 * week (see streak-risk-plan). One push per member names every group at risk.
 */
export const Route = createFileRoute("/api/public/hooks/streak-risk")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: prefs, error } = await supabaseAdmin
          .from("notification_preferences")
          .select("user_id")
          .eq("daily_reminder_enabled", true)
          .eq("push_enabled", true);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const rows = prefs ?? [];
        if (rows.length === 0) return Response.json({ ok: true, sent: 0 });

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, timezone, streak_freezes_available")
          .in(
            "id",
            rows.map((r) => r.user_id),
          );
        const tzById = new Map((profiles ?? []).map((p) => [p.id, p.timezone || "UTC"]));
        const freezesById = new Map(
          (profiles ?? []).map((p) => [p.id, (p as { streak_freezes_available?: number }).streak_freezes_available ?? 0]),
        );

        const now = new Date();
        const due = rows
          .map((r) => r.user_id)
          .filter((id) => localHourFor(tzById.get(id) ?? "UTC", now) === RISK_HOUR);
        if (due.length === 0) return Response.json({ ok: true, sent: 0, scanned: rows.length });

        async function fetchAll<T>(
          build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
        ): Promise<T[]> {
          const out: T[] = [];
          for (let from = 0; ; from += PAGE) {
            const { data, error: e } = await build(from, from + PAGE - 1);
            if (e) throw new Error(e.message);
            out.push(...(data ?? []));
            if (!data || data.length < PAGE) break;
          }
          return out;
        }

        const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 10);
        let memberships: { user_id: string; group_id: string }[];
        let checkIns: { user_id: string; group_id: string; checkin_date: string }[];
        let freezes: { user_id: string; group_id: string; freeze_date: string; kind: string }[];
        try {
          [memberships, checkIns, freezes] = await Promise.all([
            fetchAll((from, to) =>
              supabaseAdmin
                .from("group_members")
                .select("user_id, group_id")
                .in("user_id", due)
                .order("id")
                .range(from, to),
            ),
            fetchAll((from, to) =>
              supabaseAdmin
                .from("check_ins")
                .select("user_id, group_id, checkin_date")
                .in("user_id", due)
                .gte("checkin_date", since)
                .order("id")
                .range(from, to),
            ),
            fetchAll((from, to) =>
              supabaseAdmin
                .from("streak_freezes_used")
                .select("user_id, group_id, freeze_date, kind")
                .in("user_id", due)
                .gte("freeze_date", since)
                .order("id")
                .range(from, to),
            ),
          ]);
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }

        const groupIds = [...new Set(memberships.map((m) => m.group_id))];
        const { data: groups, error: gErr } = groupIds.length
          ? await supabaseAdmin.from("groups").select("id, name, frequency, days_per_week").in("id", groupIds)
          : { data: [], error: null };
        if (gErr) return Response.json({ error: gErr.message }, { status: 500 });
        const groupById = new Map((groups ?? []).map((g) => [g.id, g]));

        // user → group → activity sets
        const inputs = new Map<string, Map<string, RiskGroupInput>>();
        for (const m of memberships) {
          const g = groupById.get(m.group_id);
          if (!g) continue;
          const byGroup = inputs.get(m.user_id) ?? new Map<string, RiskGroupInput>();
          byGroup.set(m.group_id, {
            groupId: g.id,
            name: g.name,
            schedule: { frequency: g.frequency, days_per_week: g.days_per_week },
            checkIns: new Set(),
            rests: new Set(),
            freezes: new Set(),
          });
          inputs.set(m.user_id, byGroup);
        }
        for (const c of checkIns) inputs.get(c.user_id)?.get(c.group_id)?.checkIns.add(c.checkin_date);
        for (const f of freezes) {
          const g = inputs.get(f.user_id)?.get(f.group_id);
          if (!g) continue;
          (f.kind === "rest" ? g.rests : g.freezes).add(f.freeze_date);
        }

        const { pushToUsers } = await import("@/lib/notify.server");
        let atRiskUsers = 0;
        let sent = 0;
        for (const userId of due) {
          const byGroup = inputs.get(userId);
          if (!byGroup) continue;
          const risky = atRiskGroups(tzById.get(userId) ?? "UTC", [...byGroup.values()], now);
          if (risky.length === 0) continue;
          atRiskUsers += 1;
          const message = streakRiskMessage(risky, (freezesById.get(userId) ?? 0) > 0);
          const result = await pushToUsers([userId], message).catch(() => ({ webSent: 0, fcmSent: 0 }));
          sent += result.webSent + result.fcmSent;
        }

        return Response.json({ ok: true, due: due.length, atRisk: atRiskUsers, sent });
      },
    },
  },
});
