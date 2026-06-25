import { createFileRoute } from "@tanstack/react-router";
import { localHourFor } from "@/lib/daily-posts.functions";

/**
 * Hourly cron: for every user with the morning ritual reminder enabled,
 * if it's 10:00 in their local timezone, send a web push notification
 * to all their registered devices.
 */
export const Route = createFileRoute("/api/public/hooks/morning-ritual-reminder")({
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

        const publicKey = process.env.VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        const subject = process.env.VAPID_SUBJECT || "mailto:reminders@pactara.lovable.app";
        if (!publicKey || !privateKey) {
          return Response.json({ error: "VAPID keys not configured" }, { status: 500 });
        }
        webpush.setVapidDetails(subject, publicKey, privateKey);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Pull users with the morning ritual reminder enabled.
        const { data: prefs, error: pErr } = await supabaseAdmin
          .from("notification_preferences")
          .select("user_id, push_enabled, morning_ritual_reminder_enabled")
          .eq("morning_ritual_reminder_enabled", true)
          .eq("push_enabled", true);
        if (pErr) return Response.json({ error: pErr.message }, { status: 500 });

        const userIds = (prefs ?? []).map((p) => p.user_id);
        if (userIds.length === 0) return Response.json({ ok: true, sent: 0, scanned: 0 });

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, timezone")
          .in("id", userIds);

        const now = new Date();
        const dueUserIds: string[] = [];
        for (const prof of profiles ?? []) {
          const tz = prof.timezone || "UTC";
          if (localHourFor(tz, now) === 10) dueUserIds.push(prof.id);
        }
        if (dueUserIds.length === 0) {
          return Response.json({ ok: true, sent: 0, scanned: userIds.length });
        }

        const { data: subs, error: sErr } = await supabaseAdmin
          .from("push_subscriptions" as never)
          .select("id, endpoint, p256dh, auth, user_id")
          .in("user_id", dueUserIds);
        if (sErr) return Response.json({ error: sErr.message }, { status: 500 });

        const payload = JSON.stringify({
          title: "Morning ritual",
          body: "Take a moment for today's morning ritual ☀️",
          url: "/home",
        });

        let sent = 0;
        const expired: string[] = [];
        for (const s of (subs ?? []) as Array<{
          id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        }>) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            );
            sent++;
          } catch (err) {
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) expired.push(s.id);
          }
        }

        if (expired.length > 0) {
          await supabaseAdmin
            .from("push_subscriptions" as never)
            .delete()
            .in("id", expired);
        }

        return Response.json({
          ok: true,
          sent,
          due: dueUserIds.length,
          subscriptions: subs?.length ?? 0,
          expired: expired.length,
        });
      },
    },
  },
});
