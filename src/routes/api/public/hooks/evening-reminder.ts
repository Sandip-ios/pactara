import { createFileRoute } from "@tanstack/react-router";
import { localHourFor } from "@/lib/daily-posts.functions";
import {
  EVENING_REMINDER_HOURS,
  eveningReminderGroups,
  eveningReminderMessage,
} from "@/lib/streak-risk-plan";
import { loadRiskInputs } from "@/lib/streak-risk-inputs.server";
import { LAST_CALL_HOUR, planEveningPush, sendEveningPush } from "@/lib/evening-push-plan";
import { eveningPushDeps } from "@/lib/evening-push-sends.server";

const EVENING_HOURS: readonly number[] = EVENING_REMINDER_HOURS;
/** Enough history to cover this Mon–Sun week in any timezone. */
const LOOKBACK_DAYS = 9;

/**
 * Hourly cron: at 5pm and 8pm local time, reminds members about each group
 * that still needs a check-in today — nothing covers today yet and no rest
 * day is left this week (otherwise an automatic rest day covers it). One push
 * per member names every such group. 8 PM is one of the member's single
 * evening push per local day (see evening-push-plan): members with a group
 * at risk are left for the 9 PM push, and each send is recorded so a repeat
 * run can't send it twice.
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

        let sent = 0;
        let reminded = 0;
        try {
          const inputs = await loadRiskInputs(supabaseAdmin, due, now, LOOKBACK_DAYS);
          const deps = eveningPushDeps(supabaseAdmin, (userId, message) => pushToUsers([userId], message));
          for (const [hour, userIds] of dueByHour) {
            for (const userId of userIds) {
              const tz = tzById.get(userId) ?? "UTC";
              if (hour === LAST_CALL_HOUR) {
                // One evening push per member per local day, shared with the 9 PM job.
                const plan = planEveningPush({ hour, timezone: tz, groups: inputs.get(userId) ?? [], hasFreeze: false, now });
                if (!plan) continue;
                const result = await sendEveningPush(deps, userId, tz, plan, now).catch((err) => {
                  console.warn("[evening-reminder] 8 PM send failed", err);
                  return { claimed: false, delivered: 0 };
                });
                if (result.claimed) reminded += 1;
                sent += result.delivered;
                continue;
              }
              const groups = eveningReminderGroups(hour, tz, inputs.get(userId) ?? [], now);
              if (groups.length === 0) continue;
              reminded += 1;
              const result = await pushToUsers([userId], { ...eveningReminderMessage(hour, groups), crewIds: groups.map(group => group.groupId) }).catch(() => ({
                webSent: 0,
                fcmSent: 0,
              }));
              sent += result.webSent + result.fcmSent;
            }
          }
        } catch (err) {
          console.warn("[evening-reminder] check-in reminder failed", err);
        }

        // One-time nudge for members who still haven't made their group's pact
        // more than 24h after joining. Sent once, only to that member.
        let pactNudged = 0;
        try {
          const cutoff = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
          const { data: pending } = await supabaseAdmin
            .from("group_members")
            .select("id, user_id, group_id, joined_at, pact_signed_at, pact_nudged_at, groups!inner(ended_at)").is("groups.ended_at", null)
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
              title: "Your crew is waiting on you",
              body: "Make the pact to get started with your crew.",
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
            .select("id, name, owner_id, created_at, solo_nudge_count").is("ended_at", null)
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

        return Response.json({ ok: true, due: due.length, reminded, sent, pactNudged, soloNudged });
      },
    },
  },
});
