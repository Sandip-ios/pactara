import { createFileRoute } from "@tanstack/react-router";
import { localHourFor } from "@/lib/daily-posts.functions";
import { atRiskGroups, streakRiskMessage, type RiskGroupInput } from "@/lib/streak-risk-plan";
import { loadRiskInputs } from "@/lib/streak-risk-inputs.server";

/** Local hour at which the streak-at-risk warning goes out. */
const RISK_HOUR = 21;
/** How far back to load activity when measuring the streak shown in the push. */
const LOOKBACK_DAYS = 400;

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

        let inputs: Map<string, RiskGroupInput[]>;
        try {
          inputs = await loadRiskInputs(supabaseAdmin, due, now, LOOKBACK_DAYS);
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }

        const { pushToUsers } = await import("@/lib/notify.server");
        let atRiskUsers = 0;
        let sent = 0;
        for (const userId of due) {
          const groups = inputs.get(userId);
          if (!groups) continue;
          const risky = atRiskGroups(tzById.get(userId) ?? "UTC", groups, now);
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
