import { createFileRoute } from "@tanstack/react-router";

const TEAM_ID = "44274JYF42";
const BUNDLE_ID = "app.pactara";

const aasa = {
  applinks: {
    apps: [],
    details: [
      {
        appID: `${TEAM_ID}.${BUNDLE_ID}`,
        // Only invite links should hand off to the app. Matching "/" would
        // make every pactara.lovable.app link (marketing, legal, support)
        // try to open the app, which iOS then treats inconsistently.
        paths: ["/join/*"],
        components: [{ "/": "/join/*" }],
      },
    ],
  },
};

export const Route = createFileRoute("/.well-known/apple-app-site-association")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify(aasa), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
