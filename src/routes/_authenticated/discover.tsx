import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Keep the short Discover URL working while the existing screen remains at /groups. */
export const Route = createFileRoute("/_authenticated/discover")({
  component: () => <Navigate to="/groups" replace />,
  head: () => ({
    meta: [
      { title: "Discover · Pactara" },
      { name: "description", content: "Discover workout plans, workouts and meals on Pactara." },
      { property: "og:title", content: "Discover · Pactara" },
      { property: "og:description", content: "Discover workout plans, workouts and meals on Pactara." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
