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

        // Work out where each person is in their challenge, so the reminder can
        // say "Day 12 of 30 in Morning Milers".
        const { data: memberships } = await supabaseAdmin
          .from("group_members")
          .select("user_id, group_id")
          .in("user_id", recipients);

        const groupIds = Array.from(
          new Set((memberships ?? []).map((m) => m.group_id)),
        );
        const { data: groups } = groupIds.length
          ? await supabaseAdmin
              .from("groups")
              .select("id, name, start_date, duration_days")
              .in("id", groupIds)
          : { data: [] as Array<{ id: string; name: string; start_date: string; duration_days: number }> };
        const groupById = new Map((groups ?? []).map((g) => [g.id, g]));

        /** Day number (1-based) in the challenge for a given timezone, or null if outside it. */
        const dayNumber = (startDate: string, durationDays: number, tz: string) => {
          const localToday = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
          const diff = Math.round(
            (Date.parse(`${localToday}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) /
              86400000,
          );
          const day = diff + 1;
          if (day < 1 || day > durationDays) return null;
          return day;
        };

        // Group recipients by the exact message they should receive.
        const byBody = new Map<string, string[]>();
        for (const userId of recipients) {
          const tz = tzById.get(userId) ?? "UTC";
          let best: { day: number; total: number; name: string } | null = null;
          for (const m of memberships ?? []) {
            if (m.user_id !== userId) continue;
            const g = groupById.get(m.group_id);
            if (!g) continue;
            const day = dayNumber(g.start_date, g.duration_days, tz);
            if (day === null) continue;
            if (!best || day > best.day) best = { day, total: g.duration_days, name: g.name };
          }
          const body = best
            ? best.day === best.total
              ? `Final day of ${best.name} — finish strong and check in. 🏁`
              : `Day ${best.day} of ${best.total} in ${best.name} — keep it going. 🔥`
            : "Keep your streak alive — log today's check-in.";
          const list = byBody.get(body);
          if (list) list.push(userId);
          else byBody.set(body, [userId]);
        }

        const { pushToUsers } = await import("@/lib/notify.server");
        let sent = 0;
        for (const [body, users] of byBody) {
          const result = await pushToUsers(users, {
            title: "Time to check in ✅",
            body,
            url: "/check-in",
          });
          sent += (result as { sent?: number }).sent ?? 0;
        }

        return Response.json({ ok: true, due: due.length, sent });
      },
    },
  },
});
