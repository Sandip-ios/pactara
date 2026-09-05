import { createFileRoute } from "@tanstack/react-router";
import { localHourFor } from "@/lib/daily-posts.functions";

/** Local hour at which the streak-at-risk warning goes out. */
const RISK_HOUR = 21;

function localDate(tz: string, d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Hourly cron: at 9pm local time, warn users who have a live streak of 2+ days
 * but haven't checked in yet today, so they know it's about to break.
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
          .select("id, timezone")
          .in(
            "id",
            rows.map((r) => r.user_id),
          );
        const tzById = new Map((profiles ?? []).map((p) => [p.id, p.timezone || "UTC"]));

        const now = new Date();
        const due = rows
          .map((r) => r.user_id)
          .filter((id) => localHourFor(tzById.get(id) ?? "UTC", now) === RISK_HOUR);
        if (due.length === 0) return Response.json({ ok: true, sent: 0, scanned: rows.length });

        // Pull recent activity (check-ins + applied freezes) for the due users.
        const since = new Date(now.getTime() - 120 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const [{ data: checkIns }, { data: freezes }] = await Promise.all([
          supabaseAdmin
            .from("check_ins")
            .select("user_id, checkin_date")
            .in("user_id", due)
            .gte("checkin_date", since),
          supabaseAdmin
            .from("streak_freezes_used")
            .select("user_id, freeze_date")
            .in("user_id", due)
            .gte("freeze_date", since),
        ]);

        const daysByUser = new Map<string, Set<string>>();
        const add = (userId: string, day: string) => {
          const set = daysByUser.get(userId) ?? new Set<string>();
          set.add(day);
          daysByUser.set(userId, set);
        };
        for (const c of checkIns ?? []) add(c.user_id as string, c.checkin_date as string);
        for (const f of freezes ?? []) add(f.user_id as string, f.freeze_date as string);

        const atRisk: Array<{ userId: string; streak: number }> = [];
        for (const userId of due) {
          const tz = tzById.get(userId) ?? "UTC";
          const today = localDate(tz, now);
          const days = daysByUser.get(userId) ?? new Set<string>();
          if (days.has(today)) continue; // already safe for today

          // Walk back from yesterday while each day is covered.
          let streak = 0;
          let cursor = shiftDate(today, -1);
          while (days.has(cursor)) {
            streak += 1;
            cursor = shiftDate(cursor, -1);
          }
          if (streak >= 2) atRisk.push({ userId, streak });
        }

        if (atRisk.length === 0) {
          return Response.json({ ok: true, sent: 0, due: due.length });
        }

        const { pushToUsers } = await import("@/lib/notify.server");
        let sent = 0;
        // Group by streak length so the copy can name the number.
        const byStreak = new Map<number, string[]>();
        for (const r of atRisk) {
          const list = byStreak.get(r.streak) ?? [];
          list.push(r.userId);
          byStreak.set(r.streak, list);
        }
        for (const [streak, userIds] of byStreak) {
          const result = await pushToUsers(userIds, {
            title: `Your ${streak}-day streak is at risk 🔥`,
            body: "Check in before midnight to keep it alive.",
            url: "/check-in",
          });
          sent += (result as { sent?: number }).sent ?? 0;
        }

        return Response.json({ ok: true, due: due.length, atRisk: atRisk.length, sent });
      },
    },
  },
});
