import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" };
});

type SubscribeInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SubscribeInput) => {
    if (!input?.endpoint || typeof input.endpoint !== "string") {
      throw new Error("Missing endpoint");
    }
    if (!input?.keys?.p256dh || !input?.keys?.auth) {
      throw new Error("Missing subscription keys");
    }
    return {
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions" as never)
      .upsert(
        {
          user_id: userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent,
          last_used_at: new Date().toISOString(),
        } as never,
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => {
    if (!input?.endpoint) throw new Error("Missing endpoint");
    return { endpoint: input.endpoint };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions" as never)
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -- FCM tokens (native iOS/Android via @capacitor-firebase/messaging) --------

export const saveFcmToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string; platform: "ios" | "android" | "web" }) => {
    if (!input?.token || typeof input.token !== "string") throw new Error("Missing token");
    if (!["ios", "android", "web"].includes(input.platform)) throw new Error("Bad platform");
    return { token: input.token, platform: input.platform };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("fcm_tokens" as never).upsert(
      {
        user_id: userId,
        token: data.token,
        platform: data.platform,
        last_used_at: new Date().toISOString(),
      } as never,
      { onConflict: "token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFcmToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => {
    if (!input?.token) throw new Error("Missing token");
    return { token: input.token };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("fcm_tokens" as never)
      .delete()
      .eq("user_id", userId)
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const nudgeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string }) => {
    if (!input?.targetUserId || typeof input.targetUserId !== "string") {
      throw new Error("Missing targetUserId");
    }
    return { targetUserId: input.targetUserId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.targetUserId === userId) {
      return { ok: false, sent: 0, reason: "self" };
    }

    // Verify caller shares a group with the target.
    const { data: shares, error: rpcErr } = await supabase.rpc("shares_group_with", {
      _a: userId,
      _b: data.targetUserId,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (!shares) return { ok: false, sent: 0, reason: "forbidden" };

    // Caller's display name for the notification body.
    const { data: me } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    const fromName = (me?.name || "A teammate").split(" ")[0];

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:reminders@pactara.lovable.app";
    if (!publicKey || !privateKey) {
      return { ok: false, sent: 0, reason: "no-vapid" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions" as never)
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", data.targetUserId);

    const subscriptions = (subs ?? []) as Array<{
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>;
    if (subscriptions.length === 0) return { ok: true, sent: 0 };

    const { default: webpush } = await import("web-push");
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const payload = JSON.stringify({
      title: `${fromName} nudged you 👋`,
      body: "Your crew is waiting on your check-in.",
      url: "/check-in",
    });

    let sent = 0;
    const expired: string[] = [];
    for (const s of subscriptions) {
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
    return { ok: true, sent };
  });
