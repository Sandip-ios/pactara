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



// -- App icon badge ----------------------------------------------------------

/**
 * Lowers the app-icon badge for the signed-in user when they actually open the
 * item that caused it (a chat thread, a post's comments, ...). Pass `by` to
 * subtract that many items; omit it to clear the badge entirely. A silent push
 * carries the new value, since iOS only lets APNs set the icon badge.
 */
export const clearBadgeCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { by?: number }) => {
    const by = typeof input?.by === "number" && input.by > 0 ? Math.floor(input.by) : null;
    return { by };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let next = 0;
    if (data.by !== null) {
      const { data: row } = await supabaseAdmin
        .from("user_badge_counts" as never)
        .select("count")
        .eq("user_id", userId)
        .maybeSingle();
      const current = ((row ?? null) as { count?: number } | null)?.count ?? 0;
      next = Math.max(0, current - data.by);
    }

    await supabaseAdmin
      .from("user_badge_counts" as never)
      .upsert({ user_id: userId, count: next, updated_at: new Date().toISOString() } as never, {
        onConflict: "user_id",
      });

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const { data: rows } = await supabaseAdmin
          .from("fcm_tokens" as never)
          .select("token")
          .eq("user_id", userId);
        const tokens = ((rows ?? []) as Array<{ token: string }>).map((r) => r.token);
        if (tokens.length > 0) {
          const { sendBadgeUpdate } = await import("@/lib/fcm.server");
          await sendBadgeUpdate(tokens, next);
        }
      } catch (err) {
        console.warn("[push] clearBadgeCount failed", err);
      }
    }

    return { ok: true };
  });
