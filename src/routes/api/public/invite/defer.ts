import { createFileRoute } from "@tanstack/react-router";

/**
 * Called from the web invite page right before we send a visitor to the App
 * Store. Stores a short-lived (hashed IP + platform) fingerprint so the app
 * can pick the invite up automatically on its first launch.
 */
export const Route = createFileRoute("/api/public/invite/defer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          clientIp,
          platformFromUserAgent,
          fingerprint,
          isUuid,
        } = await import("@/lib/deferred-invite.server");

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }

        const groupId = (body as { groupId?: unknown } | null)?.groupId;
        if (!isUuid(groupId)) return Response.json({ ok: false }, { status: 400 });

        const ip = clientIp(request);
        if (!ip) return Response.json({ ok: false }, { status: 200 });

        const platform = platformFromUserAgent(request.headers.get("user-agent") ?? "");
        if (platform === "other") return Response.json({ ok: false }, { status: 200 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("deferred_invites").insert({
            group_id: groupId,
            ip_hash: await fingerprint(ip),
            platform,
          });
        } catch (err) {
          console.warn("[deferred-invite] store failed", err);
          return Response.json({ ok: false }, { status: 200 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
