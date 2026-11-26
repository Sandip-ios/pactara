import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NewCrewSettings, crewManagementOptions } from "@/components/redesign/NewCrewSettings";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";

export const Route = createFileRoute("/_authenticated/crews/$groupId_/settings")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(crewManagementOptions(params.groupId)),
  head: () => ({ meta: [
    { title: "Crew settings · Pactara" },
    { name: "description", content: "Manage your Pactara crew's name, description and members." },
    { property: "og:title", content: "Crew settings · Pactara" },
    { property: "og:description", content: "Manage your Pactara crew's name, description and members." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CrewSettingsRoute,
});
function CrewSettingsRoute() {
  const version = useAppVersion(), prefs = useAppPrefs(), { groupId } = Route.useParams();
  if (!prefs.isSuccess) return null;
  return version === "new" ? <NewCrewSettings groupId={groupId} /> : <Navigate to="/groups/$groupId" params={{ groupId }} replace />;
}