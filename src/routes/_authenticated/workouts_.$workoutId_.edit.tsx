import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";
import { NewWorkoutBuilder } from "@/components/redesign/NewWorkoutBuilder";

export const Route = createFileRoute("/_authenticated/workouts_/$workoutId_/edit")({
  head: () => ({
    meta: [
      { title: "Edit workout · Pactara" },
      { name: "description", content: "Change the exercises, sets, reps and tips in your workout." },
      { property: "og:title", content: "Edit workout · Pactara" },
      { property: "og:description", content: "Change the exercises, sets, reps and tips in your workout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditWorkoutRoute,
});

function EditWorkoutRoute() {
  const { workoutId } = Route.useParams();
  const version = useAppVersion();
  const { isLoading } = useAppPrefs();
  if (isLoading) return null;
  if (version !== "new") return <Navigate to="/workouts" />;
  return <NewWorkoutBuilder workoutId={workoutId} />;
}
