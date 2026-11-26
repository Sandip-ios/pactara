import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NewCrewJoinRequests, crewJoinRequestsOptions } from "@/components/redesign/NewCrewJoinRequests";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";

export const Route = createFileRoute("/_authenticated/crews/$groupId_/requests")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(crewJoinRequestsOptions(params.groupId)),
  head: () => ({ meta: [
    { title: "Join requests · Pactara" },
    { name: "description", content: "Approve or decline people asking to join your Pactara crew." },
    { property: "og:title", content: "Join requests · Pactara" },
    { property: "og:description", content: "Approve or decline people asking to join your Pactara crew." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CrewJoinRequestsRoute,
});

function CrewJoinRequestsRoute() {
  const version = useAppVersion(), prefs = useAppPrefs(), { groupId } = Route.useParams();
  if (!prefs.isSuccess) return null;
  return version === "new" ? <NewCrewJoinRequests groupId={groupId} /> : <Navigate to="/groups/$groupId" params={{ groupId }} replace />;
}
