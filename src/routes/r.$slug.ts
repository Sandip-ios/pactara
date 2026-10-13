import { createFileRoute } from "@tanstack/react-router";

const APP_STORE_URL = "https://apps.apple.com/us/app/pactara/id6779681656";

/** Creator referral link: records the tap, then sends iPhones to the App Store. */
export const Route = createFileRoute("/r/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const home = new URL("/", request.url).toString();
        try {
          const { clientIp, fingerprint, platformFromUserAgent } = await import(
            "@/lib/deferred-invite.server"
          );
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const slug = String(params.slug ?? "").toLowerCase().slice(0, 40);
          const { data: partner } = await supabaseAdmin
            .from("referral_partners")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (!partner) return Response.redirect(home, 302);
          const platform = platformFromUserAgent(request.headers.get("user-agent") ?? "");
          const ip = clientIp(request);
          const ip_hash = ip ? await fingerprint(ip) : "unknown";
          const rows = [{ partner_id: partner.id, event: "tap", platform, ip_hash }];
          if (platform === "ios") rows.push({ partner_id: partner.id, event: "store", platform, ip_hash });
          await supabaseAdmin.from("referral_events").insert(rows);
          return Response.redirect(platform === "ios" ? APP_STORE_URL : home, 302);
        } catch (err) {
          console.warn("[referral] tap failed", err);
          return Response.redirect(home, 302);
        }
      },
    },
  },
});
