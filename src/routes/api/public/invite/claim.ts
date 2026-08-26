import { createFileRoute } from "@tanstack/react-router";

/**
 * Called once by the native app on a cold launch. If an invite was recorded
 * from the same network + platform in the last few hours, we hand the group id
 * back (and mark it claimed) so the app can open the join screen directly.
 */
export const Route = createFileRoute("/api/public/invite/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { clientIp, fingerprint, windowStartIso } = await import(
          "@/lib/deferred-invite.server"
        );

        let platform = "";
        try {
          const body = (await request.json()) as { platform?: unknown } | null;
          platform = typeof body?.platform === "string" ? body.platform : "";
        } catch {
          // no body
        }
        if (platform !== "ios" && platform !== "android") {
          return Response.json({ groupId: null });
        }

        const ip = clientIp(request);
        if (!ip) return Response.json({ groupId: null });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const ipHash = await fingerprint(ip);
          const { data } = await supabaseAdmin
            .from("deferred_invites")
            .select("id, group_id")
            .eq("ip_hash", ipHash)
            .eq("platform", platform)
            .is("claimed_at", null)
            .gte("created_at", windowStartIso())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!data) return Response.json({ groupId: null });

          await supabaseAdmin
            .from("deferred_invites")
            .update({ claimed_at: new Date().toISOString() })
            .eq("id", data.id);

          return Response.json({ groupId: data.group_id });
        } catch (err) {
          console.warn("[deferred-invite] claim failed", err);
          return Response.json({ groupId: null });
        }
      },
    },
  },
});
