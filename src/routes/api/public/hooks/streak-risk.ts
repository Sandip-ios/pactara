import { createFileRoute } from "@tanstack/react-router";
import { localHourFor } from "@/lib/daily-posts.functions";
import { type RiskGroupInput } from "@/lib/streak-risk-plan";
import { loadRiskInputs } from "@/lib/streak-risk-inputs.server";
import { STREAK_RISK_HOUR, planEveningPush, sendEveningPush } from "@/lib/evening-push-plan";
import { eveningPushDeps } from "@/lib/evening-push-sends.server";

/** Local hour at which the streak-at-risk warning goes out. */
const RISK_HOUR = STREAK_RISK_HOUR;
/** How far back to load activity when measuring the streak shown in the push. */
const LOOKBACK_DAYS = 400;

/**
 * Hourly cron: at 9pm local time, warn members whose day would really be
 * missed — per group, no check-in today and no rest days left this Mon–Sun
 * week (see streak-risk-plan). One push per member names every group at risk,
 * and only if no 8 PM push reached them tonight (see evening-push-plan).
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
        const deps = eveningPushDeps(supabaseAdmin, (userId, message) => pushToUsers([userId], message));
        let skipped = 0;
        for (const userId of due) {
          const groups = inputs.get(userId);
          if (!groups) continue;
          const tz = tzById.get(userId) ?? "UTC";
          const plan = planEveningPush({
            hour: STREAK_RISK_HOUR,
            timezone: tz,
            groups,
            hasFreeze: (freezesById.get(userId) ?? 0) > 0,
            now,
          });
          if (!plan) continue;
          atRiskUsers += 1;
          // Skipped when tonight's 8 PM push already reached them (or a repeat run already sent).
          const result = await sendEveningPush(deps, userId, tz, plan, now).catch((err) => {
            console.warn("[streak-risk] send failed", err);
            return { claimed: false, delivered: 0 };
          });
          if (!result.claimed) skipped += 1;
          sent += result.delivered;
        }

        return Response.json({ ok: true, due: due.length, atRisk: atRiskUsers, skipped, sent });
      },
    },
  },
});
