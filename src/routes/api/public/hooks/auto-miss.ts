import { createFileRoute } from "@tanstack/react-router";
import { localDateFor, localHourFor } from "@/lib/daily-posts.functions";

/**
 * Hourly job: for every user with a group, in their own timezone, mark:
 *   - missed morning ritual if local time >= 12:00 and today's daily_post has no ritual
 *   - missed check-in for yesterday if local time has crossed midnight and yesterday's post has no check-in
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

        // Find every user that is a member of at least one group, with their primary group + tz.
        const { data: memberships, error: mErr } = await supabaseAdmin
          .from("group_members")
          .select("user_id, group_id, joined_at")
          .order("joined_at", { ascending: false });
        if (mErr) {
          return Response.json({ error: mErr.message }, { status: 500 });
        }

        // Keep only the most recent membership per user (their "primary" group).
        const primary = new Map<string, { groupId: string }>();
        for (const m of memberships ?? []) {
          if (!primary.has(m.user_id)) primary.set(m.user_id, { groupId: m.group_id });
        }
        const userIds = Array.from(primary.keys());
        if (userIds.length === 0) return Response.json({ ok: true, scanned: 0 });

        const { data: profs, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("id, timezone")
          .in("id", userIds);
        if (pErr) return Response.json({ error: pErr.message }, { status: 500 });

        const now = new Date();
        let ritualMissed = 0;
        let checkInMissed = 0;

        for (const prof of profs ?? []) {
          const tz = prof.timezone || "UTC";
          const groupId = primary.get(prof.id)!.groupId;
          const today = localDateFor(tz, now);
          const hour = localHourFor(tz, now);

          // ── Missed morning ritual: past noon, no ritual posted today
          if (hour >= 12) {
            const { data: existing } = await supabaseAdmin
              .from("daily_posts")
              .select("id, morning_ritual_posted_at, morning_missed")
              .eq("user_id", prof.id)
              .eq("group_id", groupId)
              .eq("local_date", today)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabaseAdmin.from("daily_posts").insert({
                user_id: prof.id,
                group_id: groupId,
                local_date: today,
                morning_missed: true,
              });
              if (!error) ritualMissed++;
            } else if (!existing.morning_ritual_posted_at && !existing.morning_missed) {
              const { error } = await supabaseAdmin
                .from("daily_posts")
                .update({ morning_missed: true })
                .eq("id", existing.id);
              if (!error) ritualMissed++;
            }
          }

          // ── Missed check-in: it's now past midnight in their tz, so yesterday is closed.
          // Yesterday in their tz = localDateFor(tz, now - 1 hour past midnight)
          const yesterday = localDateFor(tz, new Date(now.getTime() - 60 * 60 * 1000 * (hour + 1)));
          if (yesterday !== today) {
            const { data: y } = await supabaseAdmin
              .from("daily_posts")
              .select("id, check_in_id, check_in_missed")
              .eq("user_id", prof.id)
              .eq("group_id", groupId)
              .eq("local_date", yesterday)
              .maybeSingle();

            if (!y) {
              // No record at all for yesterday → both missed
              const { error } = await supabaseAdmin.from("daily_posts").insert({
                user_id: prof.id,
                group_id: groupId,
                local_date: yesterday,
                morning_missed: true,
                check_in_missed: true,
              });
              if (!error) checkInMissed++;
            } else if (!y.check_in_id && !y.check_in_missed) {
              const { error } = await supabaseAdmin
                .from("daily_posts")
                .update({ check_in_missed: true })
                .eq("id", y.id);
              if (!error) checkInMissed++;
            }
          }
        }

        return Response.json({
          ok: true,
          scanned: userIds.length,
          ritualMissed,
          checkInMissed,
        });
      },
    },
  },
});
