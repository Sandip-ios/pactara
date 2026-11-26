import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NewCrewPreview } from "@/components/redesign/NewCrewPreview";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";

export const Route = createFileRoute("/_authenticated/crews/$groupId_/preview")({
  head: () => ({ meta: [
    { title: "Crew preview · Pactara" },
    { name: "description", content: "See what a Pactara crew is about and ask to join it." },
    { property: "og:title", content: "Crew preview · Pactara" },
    { property: "og:description", content: "See what a Pactara crew is about and ask to join it." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CrewPreviewRoute,
});

function CrewPreviewRoute() {
  const version = useAppVersion(), prefs = useAppPrefs(), { groupId } = Route.useParams();
  if (!prefs.isSuccess) return null;
  return version === "new" ? <NewCrewPreview groupId={groupId} /> : <Navigate to="/groups" replace />;
}
