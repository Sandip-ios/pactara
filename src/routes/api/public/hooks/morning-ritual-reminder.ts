import { createFileRoute } from "@tanstack/react-router";

/**
 * Retired: the daily commitment (and its 10 AM / 11 AM reminders) was removed.
 * The hourly cron may still call this URL, so it answers OK and sends nothing.
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
        return Response.json({ ok: true, sent: 0, retired: true });
      },
    },
  },
});
