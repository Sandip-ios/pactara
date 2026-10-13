import { createFileRoute } from "@tanstack/react-router";

/** Fresh native install: match the device's network to a recent creator-link App Store visit. */
export const Route = createFileRoute("/api/public/referral/install")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { clientIp, fingerprint } = await import("@/lib/deferred-invite.server");
          const ip = clientIp(request);
          if (!ip) return Response.json({ installId: null });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const ipHash = await fingerprint(ip);
          const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
          const { data: ev } = await supabaseAdmin
            .from("referral_events")
            .select("id, partner_id")
            .eq("event", "store")
            .eq("ip_hash", ipHash)
            .is("claimed_at", null)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!ev) return Response.json({ installId: null });
          await supabaseAdmin
            .from("referral_events")
            .update({ claimed_at: new Date().toISOString() })
            .eq("id", ev.id);
          const { data: inst } = await supabaseAdmin
            .from("referral_installs")
            .insert({ partner_id: ev.partner_id })
            .select("id")
            .single();
          return Response.json({ installId: inst?.id ?? null });
        } catch (err) {
          console.warn("[referral] install failed", err);
          return Response.json({ installId: null });
        }
      },
    },
  },
});
