import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NewCrewScreen } from "@/components/redesign/NewCrewScreen";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";

export const Route = createFileRoute("/_authenticated/crews/$groupId")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(search["crewTab"] === "chat" ? { crewTab: "chat" as const } : {}),
    ...(search["compose"] === true || search["compose"] === 1 || search["compose"] === "1" ? { compose: true } : {}),
  }),
  head: () => ({ meta: [
    { title: "Crew today · Pactara" },
    { name: "description", content: "Your crew's check-ins, week, posts and chat on Pactara." },
    { property: "og:title", content: "Crew today · Pactara" },
    { property: "og:description", content: "Your crew's check-ins, week, posts and chat on Pactara." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CrewRoute,
});

function CrewRoute() {
  const version = useAppVersion();
  const prefs = useAppPrefs();
  const { groupId } = Route.useParams();
  if (!prefs.isSuccess) return null;
  return version === "new" ? <NewCrewScreen groupId={groupId} /> : <Navigate to="/groups/$groupId" params={{ groupId }} replace />;
}
