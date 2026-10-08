import { createFileRoute } from "@tanstack/react-router";
import { localHourFor } from "@/lib/daily-posts.functions";

/**
 * Hourly cron: for every user with the today's commitment reminder enabled,
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
        const { default: webpush } = await import("web-push");
        webpush.setVapidDetails(subject, publicKey, privateKey);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Pull users with the today's commitment reminder enabled.
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
        const tzById = new Map<string, string>();
        const dueUserIds: string[] = [];
        const hourById = new Map<string, number>();
        const msgFor = (id: string) =>
          hourById.get(id) === 11
            ? { title: "1 hour left ⏰", body: "Make today's commitment before noon to keep your streak.", url: "/check-in" }
            : { title: "Today's commitment", body: "Take a moment for today's commitment ☀️", url: "/check-in" };
        for (const prof of profiles ?? []) {
          const tz = prof.timezone || "UTC";
          tzById.set(prof.id, tz);
          const h = localHourFor(tz, now);
          if (h === 10 || h === 11) {
            dueUserIds.push(prof.id);
            hourById.set(prof.id, h);
          }
        }
        if (dueUserIds.length === 0) {
          return Response.json({ ok: true, sent: 0, scanned: userIds.length });
        }

        // Skip anyone who already posted their commitment on their local date.
        const { data: posted } = await supabaseAdmin
          .from("daily_posts")
          .select("user_id, local_date, morning_ritual_posted_at")
          .in("user_id", dueUserIds)
          .not("morning_ritual_posted_at", "is", null)
          .gte("local_date", new Date(now.getTime() - 36 * 3600 * 1000).toISOString().slice(0, 10));
        const alreadyPosted = new Set(
          (posted ?? [])
            .filter((p) => {
              const tz = tzById.get(p.user_id as string) ?? "UTC";
              const localToday = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
              return p.local_date === localToday;
            })
            .map((p) => p.user_id as string),
        );
        const remaining = dueUserIds.filter((id) => !alreadyPosted.has(id));
        if (remaining.length === 0) {
          return Response.json({ ok: true, sent: 0, due: dueUserIds.length });
        }
        dueUserIds.length = 0;
        dueUserIds.push(...remaining);


        const { data: subs, error: sErr } = await supabaseAdmin
          .from("push_subscriptions" as never)
          .select("id, endpoint, p256dh, auth, user_id")
          .in("user_id", dueUserIds);
        if (sErr) return Response.json({ error: sErr.message }, { status: 500 });


        let sent = 0;
        const expired: string[] = [];
        for (const s of (subs ?? []) as Array<{
          id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_id: string;
        }>) {
          const payload = JSON.stringify(msgFor(s.user_id));
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

        // --- FCM (iOS / Android) --------------------------------------------
        let fcmSent = 0;
        let fcmExpired = 0;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          const { data: fcmRows } = await supabaseAdmin
            .from("fcm_tokens" as never)
            .select("token, user_id")
            .in("user_id", dueUserIds);
          const fcmList = (fcmRows ?? []) as Array<{ token: string; user_id: string }>;
          for (const hr of [10, 11]) {
            const tokens = fcmList.filter((r) => hourById.get(r.user_id) === hr).map((r) => r.token);
            if (tokens.length === 0) continue;
            const sample = fcmList.find((r) => hourById.get(r.user_id) === hr)!;
            try {
              const { sendFcm } = await import("@/lib/fcm.server");
              const result = await sendFcm(tokens, msgFor(sample.user_id));
              fcmSent += result.sent;
              fcmExpired += result.expired.length;
              if (result.expired.length > 0) {
                await supabaseAdmin
                  .from("fcm_tokens" as never)
                  .delete()
                  .in("token", result.expired);
              }
            } catch (err) {
              console.warn("[cron] FCM send failed", err);
            }
          }
        }

        return Response.json({
          ok: true,
          sent,
          fcmSent,
          due: dueUserIds.length,
          subscriptions: subs?.length ?? 0,
          expired: expired.length,
          fcmExpired,
        });
      },
    },
  },
});
