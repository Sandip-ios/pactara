import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Ties a referred install to the account created on that device (verified bearer token). */
export const Route = createFileRoute("/api/public/referral/link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const parsed = z.object({ installId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
        if (!token || !parsed.success) return Response.json({ ok: false }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: u } = await supabaseAdmin.auth.getUser(token);
        const user = u.user;
        if (!user) return Response.json({ ok: false }, { status: 401 });
        const { data: inst } = await supabaseAdmin
          .from("referral_installs")
          .select("id, user_id, created_at")
          .eq("id", parsed.data.installId)
          .maybeSingle();
        // Only brand-new accounts created after the install count.
        if (!inst || inst.user_id || new Date(user.created_at) < new Date(inst.created_at)) {
          return Response.json({ ok: false, done: true });
        }
        await supabaseAdmin
          .from("referral_installs")
          .update({ user_id: user.id, linked_at: new Date().toISOString() })
          .eq("id", inst.id)
          .is("user_id", null);
        return Response.json({ ok: true, done: true });
      },
    },
  },
});
