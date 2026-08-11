import { createFileRoute } from "@tanstack/react-router";

const ENTITLEMENT_ID = "premium";

// Event types that mean the entitlement is no longer active.
const INACTIVE_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "SUBSCRIPTION_PAUSED",
  "REFUND",
]);

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export const Route = createFileRoute("/api/public/hooks/revenuecat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["REVENUECAT_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[revenuecat-hook] REVENUECAT_WEBHOOK_SECRET is not configured");
          return new Response("Not configured", { status: 500 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = payload?.event;
        if (!event || typeof event !== "object") {
          return new Response("Missing event", { status: 400 });
        }

        // We identify RevenueCat users with the Supabase user id.
        const candidates: unknown[] = [
          event.app_user_id,
          event.original_app_user_id,
          ...(Array.isArray(event.aliases) ? event.aliases : []),
        ];
        const userId = candidates.find(isUuid);
        if (!userId) {
          // Anonymous RevenueCat user — nothing to persist.
          return Response.json({ ok: true, skipped: "no_supabase_user" });
        }

        const type = String(event.type ?? "");
        const expiresAtMs = Number(event.expiration_at_ms ?? 0);
        const expiresAt = expiresAtMs > 0 ? new Date(expiresAtMs).toISOString() : null;
        const entitlements: string[] = Array.isArray(event.entitlement_ids)
          ? event.entitlement_ids
          : event.entitlement_id
            ? [event.entitlement_id]
            : [];
        const matchesEntitlement =
          entitlements.length === 0 || entitlements.includes(ENTITLEMENT_ID);

        let isActive = matchesEntitlement && !INACTIVE_EVENTS.has(type);
        if (isActive && expiresAtMs > 0 && expiresAtMs < Date.now()) isActive = false;
        // Cancellation keeps access until the paid period ends.
        if (type === "CANCELLATION" && expiresAtMs > Date.now()) isActive = true;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            is_active: isActive,
            entitlement: entitlements[0] ?? ENTITLEMENT_ID,
            product_id: event.product_id ?? null,
            store: event.store ?? null,
            period_type: event.period_type ?? null,
            expires_at: expiresAt,
            last_event_type: type || null,
            last_event_at: new Date(Number(event.event_timestamp_ms ?? Date.now())).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

        if (error) {
          console.error("[revenuecat-hook] upsert failed", error);
          return new Response("Failed to persist subscription", { status: 500 });
        }

        return Response.json({ ok: true, userId, isActive, type });
      },
    },
  },
});
