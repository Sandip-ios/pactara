import { createFileRoute } from "@tanstack/react-router";
import { localHourFor } from "@/lib/daily-posts.functions";

const EVENING_HOURS = [17, 20];

const COPY: Record<number, { title: string; body: string }> = {
  17: { title: "Still time to check in ⏳", body: "Log today's check-in before the day gets away." },
  20: { title: "Last call to check in 🌙", body: "Don't break your streak — check in before bed." },
};

/**
 * Hourly cron: nudges users at 5pm and 8pm local time if they haven't
 * checked in yet today.
 */
export const Route = createFileRoute("/api/public/hooks/evening-reminder")({
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
          .select("id, timezone")
          .in(
            "id",
            rows.map((r) => r.user_id),
          );
        const tzById = new Map((profiles ?? []).map((p) => [p.id, p.timezone || "UTC"]));

        const now = new Date();
        // Group due users by which evening hour they're currently at.
        const dueByHour = new Map<number, string[]>();
        for (const r of rows) {
          const local = localHourFor(tzById.get(r.user_id) ?? "UTC", now);
          if (!EVENING_HOURS.includes(local)) continue;
          const list = dueByHour.get(local) ?? [];
          list.push(r.user_id);
          dueByHour.set(local, list);
        }

        const due = [...dueByHour.values()].flat();
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

        const { pushToUsers } = await import("@/lib/notify.server");
        let sent = 0;
        for (const hour of EVENING_HOURS) {
          const recipients = (dueByHour.get(hour) ?? []).filter((id) => !alreadyToday.has(id));
          if (recipients.length === 0) continue;
          const result = await pushToUsers(recipients, {
            ...COPY[hour],
            url: "/check-in",
          });
          sent += (result as { sent?: number }).sent ?? 0;
        }

        return Response.json({ ok: true, due: due.length, sent });
      },
    },
  },
});
