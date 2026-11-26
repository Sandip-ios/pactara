import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";
import { NewWorkoutPage } from "@/components/redesign/NewWorkoutPage";

export const Route = createFileRoute("/_authenticated/workouts_/$workoutId")({
  head: () => ({
    meta: [
      { title: "Workout · Pactara" },
      { name: "description", content: "Every exercise in this workout, with sets, reps and tips. Start it now or save it." },
      { property: "og:title", content: "Workout · Pactara" },
      { property: "og:description", content: "Every exercise in this workout, with sets, reps and tips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkoutRoute,
});

function WorkoutRoute() {
  const { workoutId } = Route.useParams();
  const version = useAppVersion();
  const { isLoading } = useAppPrefs();
  if (isLoading) return null;
  // New version only; classic keeps its My workouts screens.
  if (version !== "new") return <Navigate to="/workouts" />;
  return <NewWorkoutPage id={workoutId} />;
}
