import { createFileRoute } from "@tanstack/react-router";
import { localHourFor } from "@/lib/daily-posts.functions";
import { localDateIn } from "@/lib/streak-rules";
import { morningReminderGroups, morningReminderMessage } from "@/lib/streak-risk-plan";
import { loadRiskInputs } from "@/lib/streak-risk-inputs.server";

/** Enough history to cover today in any timezone. */
const LOOKBACK_DAYS = 2;

/**
 * Hourly cron: sends each user their daily check-in reminder at the hour they
 * chose (notification_preferences.daily_reminder_time), in their local timezone.
 * Each group is judged on its own: groups already covered today (check-in,
 * rest or freeze row) are skipped; one push names the groups still waiting.
 */
export const Route = createFileRoute("/api/public/hooks/daily-reminder")({
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
          .select("user_id, daily_reminder_time")
          .eq("daily_reminder_enabled", true)
          .eq("push_enabled", true);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const rows = prefs ?? [];
        if (rows.length === 0) return Response.json({ ok: true, sent: 0 });

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, timezone")
          .in(
            "id",
            rows.map((r) => r.user_id),
          );
        const tzById = new Map((profiles ?? []).map((p) => [p.id, p.timezone || "UTC"]));

        const now = new Date();
        const due: string[] = [];
        for (const r of rows) {
          const hour = Number(String(r.daily_reminder_time ?? "09:00:00").slice(0, 2));
          if (localHourFor(tzById.get(r.user_id) ?? "UTC", now) === hour) due.push(r.user_id);
        }
        if (due.length === 0) return Response.json({ ok: true, sent: 0, scanned: rows.length });

        // Each group on its own: skip groups whose day is already covered
        // (check-in, rest or freeze row). Rest days left don't suppress this one.
        const inputs = await loadRiskInputs(supabaseAdmin, due, now, LOOKBACK_DAYS);

        // Challenge position per group, so a single-group push can say "Day 12 of 30".
        const groupIds = Array.from(new Set([...inputs.values()].flat().map((g) => g.groupId)));
        const { data: groups } = groupIds.length
          ? await supabaseAdmin.from("groups").select("id, start_date, duration_days").in("id", groupIds)
          : { data: [] as Array<{ id: string; start_date: string; duration_days: number }> };
        const groupById = new Map((groups ?? []).map((g) => [g.id, g]));

        /** Day number (1-based) in the challenge for a given timezone, or null if outside it. */
        const dayNumber = (startDate: string | null, durationDays: number | null, tz: string) => {
          if (!startDate || !durationDays) return null;
          const day = Math.round((Date.parse(`${localDateIn(tz, now)}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
          return day < 1 || day > durationDays ? null : day;
        };

        const { pushToUsers } = await import("@/lib/notify.server");
        let sent = 0;
        let reminded = 0;
        for (const userId of due) {
          const tz = tzById.get(userId) ?? "UTC";
          const need = morningReminderGroups(tz, inputs.get(userId) ?? [], now);
          if (need.length === 0) continue;
          reminded += 1;
          const message = morningReminderMessage(
            need.map((g) => {
              const info = groupById.get(g.groupId);
              return {
                groupId: g.groupId,
                name: g.name,
                day: info ? dayNumber(info.start_date, info.duration_days, tz) : null,
                total: info?.duration_days ?? null,
              };
            }),
          );
          const result = await pushToUsers([userId], message).catch(() => ({ webSent: 0, fcmSent: 0 }));
          sent += result.webSent + result.fcmSent;
        }

        return Response.json({ ok: true, due: due.length, reminded, sent });
      },
    },
  },
});
