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

        // Find every membership (user × group). Missed posts are per-group.
        const { data: memberships, error: mErr } = await supabaseAdmin
          .from("group_members")
          .select("user_id, group_id, joined_at");
        if (mErr) {
          return Response.json({ error: mErr.message }, { status: 500 });
        }

        const allMemberships = memberships ?? [];
        const userIds = Array.from(new Set(allMemberships.map((m) => m.user_id)));
        if (userIds.length === 0) return Response.json({ ok: true, scanned: 0 });


        const { data: profs, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("id, timezone")
          .in("id", userIds);
        if (pErr) return Response.json({ error: pErr.message }, { status: 500 });

        const tzByUser = new Map<string, string>();
        for (const p of profs ?? []) tzByUser.set(p.id, p.timezone || "UTC");

        const now = new Date();
        let ritualMissed = 0;
        let checkInMissed = 0;

        for (const m of allMemberships) {
          const tz = tzByUser.get(m.user_id) || "UTC";
          const userId = m.user_id;
          const groupId = m.group_id;
          const joinedAt = m.joined_at;
          const today = localDateFor(tz, now);
          const joinedLocalDate = localDateFor(tz, new Date(joinedAt));
          const hour = localHourFor(tz, now);

          // ── Missed morning ritual: past noon, no ritual posted today.
          if (hour >= 12 && today >= joinedLocalDate) {
            const { data: existing } = await supabaseAdmin
              .from("daily_posts")
              .select("id, morning_ritual_posted_at, morning_missed")
              .eq("user_id", userId)
              .eq("group_id", groupId)
              .eq("local_date", today)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabaseAdmin.from("daily_posts").insert({
                user_id: userId,
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
          // Yesterday in their tz = localDateFor(tz, now - 1 hour past midnight).
          // Only counts if the user was already a member on that day.
          const yesterday = localDateFor(tz, new Date(now.getTime() - 60 * 60 * 1000 * (hour + 1)));
          if (yesterday !== today && yesterday >= joinedLocalDate) {
            const { data: y } = await supabaseAdmin
              .from("daily_posts")
              .select("id, check_in_id, check_in_missed")
              .eq("user_id", userId)
              .eq("group_id", groupId)
              .eq("local_date", yesterday)
              .maybeSingle();

            if (!y) {
              // No record at all for yesterday → both missed
              const { error } = await supabaseAdmin.from("daily_posts").insert({
                user_id: userId,
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
