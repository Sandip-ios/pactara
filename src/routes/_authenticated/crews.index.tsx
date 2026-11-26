import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NewCrewsScreen } from "@/components/redesign/NewCrewsScreen";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";

export const Route = createFileRoute("/_authenticated/crews/")({
  head: () => ({ meta: [
    { title: "Crews · Pactara" },
    { name: "description", content: "See your Pactara crews and who has checked in today." },
    { property: "og:title", content: "Crews · Pactara" },
    { property: "og:description", content: "See your Pactara crews and who has checked in today." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CrewsRoute,
});

function CrewsRoute() {
  const version = useAppVersion();
  const prefs = useAppPrefs();
  if (!prefs.isSuccess) return null;
  return version === "new" ? <NewCrewsScreen /> : <Navigate to="/groups" replace />;
}
