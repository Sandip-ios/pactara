// TEMPORARY test endpoint — sends dummy push notifications to every user with
// a registered FCM token. Remove before shipping if no longer needed.
import { createFileRoute } from "@tanstack/react-router";
import { pushToUsers } from "@/lib/notify.server";

export const Route = createFileRoute("/api/public/test-push")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data } = await supabaseAdmin
          .from("fcm_tokens" as never)
          .select("user_id");
        const userIds = [
          ...new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
        ];
        if (userIds.length === 0) {
          return Response.json({ ok: false, reason: "no fcm tokens" });
        }
        const first = await pushToUsers(userIds, {
          title: "Dummy notification 1 🧪",
          body: "This is a test push from the server.",
          url: "/home",
        });
        const second = await pushToUsers(userIds, {
          title: "Dummy notification 2 🧪",
          body: "If you can see this, in-app event pushes are working.",
          url: "/home",
        });
        return Response.json({ ok: true, userIds: userIds.length, first, second });
      },
    },
  },
});
