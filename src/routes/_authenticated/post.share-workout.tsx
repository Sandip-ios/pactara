import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NewOnly } from "@/components/redesign/post/NewOnly";
import { NewShareWorkout } from "@/components/redesign/post/NewShareWorkout";

type S = { workoutId?: string; sessionId?: string };
export const Route = createFileRoute("/_authenticated/post/share-workout")({
  validateSearch: (s: Record<string, unknown>): S => ({
    ...(typeof s.workoutId === "string" ? { workoutId: s.workoutId } : {}),
    ...(typeof s.sessionId === "string" ? { sessionId: s.sessionId } : {}),
  }),
  head: () => ({ meta: [{ title: "Share workout · Pactara" }, { name: "description", content: "Post your workout, with or without a photo." }, { property: "og:title", content: "Share workout · Pactara" }, { property: "og:description", content: "Post your workout, with or without a photo." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});
function Page() {
  const { workoutId, sessionId } = Route.useSearch();
  if (!workoutId && !sessionId) return <Navigate to="/home" replace />;
  return <NewOnly><NewShareWorkout workoutId={workoutId ?? null} sessionId={sessionId ?? null} /></NewOnly>;
}
