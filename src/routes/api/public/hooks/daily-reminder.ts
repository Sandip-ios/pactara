import { createFileRoute } from "@tanstack/react-router";
import { localHourFor } from "@/lib/daily-posts.functions";

/**
 * Hourly cron: sends each user their daily check-in reminder at the hour they
 * chose (notification_preferences.daily_reminder_time), in their local timezone.
 * Users who already checked in today are skipped.
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

        // Skip anyone who already checked in on their local date.
        const { data: checked } = await supabaseAdmin
          .from("check_ins")
          .select("user_id, checkin_date")
          .in("user_id", due)
          .gte("checkin_date", new Date(now.getTime() - 36 * 3600 * 1000).toISOString().slice(0, 10));
        const alreadyToday = new Set(
          (checked ?? [])
            .filter((c) => {
              const tz = tzById.get(c.user_id) ?? "UTC";
              const localToday = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
              return c.checkin_date === localToday;
            })
            .map((c) => c.user_id),
        );
        const recipients = due.filter((id) => !alreadyToday.has(id));
        if (recipients.length === 0) return Response.json({ ok: true, sent: 0, due: due.length });

        const { pushToUsers } = await import("@/lib/notify.server");
        const result = await pushToUsers(recipients, {
          title: "Time to check in ✅",
          body: "Keep your streak alive — log today's check-in.",
          url: "/check-in",
        });

        return Response.json({ ok: true, due: due.length, ...result });
      },
    },
  },
});
