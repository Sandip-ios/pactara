import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";
import { NewWorkoutBuilder } from "@/components/redesign/NewWorkoutBuilder";

export const Route = createFileRoute("/_authenticated/workouts_/new")({
  head: () => ({
    meta: [
      { title: "New workout · Pactara" },
      { name: "description", content: "Build a workout: pick exercises, sets, reps and tips, then save it." },
      { property: "og:title", content: "New workout · Pactara" },
      { property: "og:description", content: "Build a workout with exercises, sets, reps and tips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewWorkoutRoute,
});

function NewWorkoutRoute() {
  const version = useAppVersion();
  const { isLoading } = useAppPrefs();
  if (isLoading) return null;
  if (version !== "new") return <Navigate to="/workouts" />;
  return <NewWorkoutBuilder />;
}
