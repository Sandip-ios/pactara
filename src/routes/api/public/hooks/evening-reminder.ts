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

        const { pushToUsers } = await import("@/lib/notify.server");
        const due = [...dueByHour.values()].flat();

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

        // One-time nudge for members who still haven't made their group's pact
        // more than 24h after joining. Sent once, only to that member.
        let pactNudged = 0;
        try {
          const cutoff = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
          const { data: pending } = await supabaseAdmin
            .from("group_members")
            .select("id, user_id, group_id, joined_at, pact_signed_at, pact_nudged_at")
            .is("pact_signed_at", null)
            .is("pact_nudged_at", null)
            .lt("joined_at", cutoff)
            .limit(200);
          const rows2 = (pending ?? []) as Array<{
            id: string;
            user_id: string;
            group_id: string;
          }>;
          for (const r of rows2) {
            await pushToUsers([r.user_id], {
              title: "Your group is waiting on you",
              body: "Make the pact to get started with your group.",
              url: `/pact/${r.group_id}`,
            });
            await supabaseAdmin
              .from("group_members")
              .update({ pact_nudged_at: new Date().toISOString() } as never)
              .eq("id", r.id);
            pactNudged++;
          }
        } catch (err) {
          console.warn("[evening-reminder] pact nudge failed", err);
        }

        // Solo-group reminder: owners still alone in their group get up to two
        // nudges (1 day and 3 days after creating it), at 5pm their local time.
        let soloNudged = 0;
        try {
          const { data: groups } = await supabaseAdmin
            .from("groups")
            .select("id, name, owner_id, created_at, solo_nudge_count")
            .lt("solo_nudge_count", 2)
            .lt("created_at", new Date(now.getTime() - 24 * 3600 * 1000).toISOString())
            .gt("created_at", new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString())
            .limit(500);
          const candidates = (groups ?? []).filter((g) => {
            const ageDays = (now.getTime() - new Date(g.created_at).getTime()) / 86400000;
            return g.solo_nudge_count === 0 ? ageDays >= 1 : ageDays >= 3;
          });
          if (candidates.length) {
            const { data: members } = await supabaseAdmin
              .from("group_members")
              .select("group_id")
              .in("group_id", candidates.map((g) => g.id));
            const counts = new Map<string, number>();
            for (const m of members ?? []) counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
            const solo = candidates.filter((g) => (counts.get(g.id) ?? 0) <= 1);
            const { data: ownerProfiles } = await supabaseAdmin
              .from("profiles")
              .select("id, timezone")
              .in("id", solo.map((g) => g.owner_id));
            const ownerTz = new Map((ownerProfiles ?? []).map((p) => [p.id, p.timezone || "UTC"]));
            for (const g of solo) {
              if (localHourFor(ownerTz.get(g.owner_id) ?? "UTC", now) !== 17) continue;
              const first = g.solo_nudge_count === 0;
              await pushToUsers([g.owner_id], {
                title: first ? "Pactara works better together" : "Still flying solo?",
                body: first
                  ? `Invite a friend to ${g.name} so someone's counting on you.`
                  : `Share your invite link or QR code — one friend is all ${g.name} needs.`,
                url: `/groups/${g.id}`,
              });
              await supabaseAdmin
                .from("groups")
                .update({ solo_nudge_count: g.solo_nudge_count + 1, solo_nudged_at: now.toISOString() })
                .eq("id", g.id);
              soloNudged++;
            }
          }
        } catch (err) {
          console.warn("[evening-reminder] solo nudge failed", err);
        }

        return Response.json({ ok: true, due: due.length, sent, pactNudged, soloNudged });
      },
    },
  },
});
