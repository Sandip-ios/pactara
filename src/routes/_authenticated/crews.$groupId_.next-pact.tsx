import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NewNextPact } from "@/components/redesign/NewNextPact";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";

export const Route = createFileRoute("/_authenticated/crews/$groupId_/next-pact")({
  head: () => ({ meta: [
    { title: "Next pact · Pactara" },
    { name: "description", content: "Pick the length and workouts a week for your crew's next pact." },
    { property: "og:title", content: "Next pact · Pactara" },
    { property: "og:description", content: "Pick the length and workouts a week for your crew's next pact." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: NextPactRoute,
});

function NextPactRoute() {
  const version = useAppVersion(), prefs = useAppPrefs(), { groupId } = Route.useParams();
  if (!prefs.isSuccess) return null;
  return version === "new" ? <NewNextPact groupId={groupId} /> : <Navigate to="/groups/$groupId" params={{ groupId }} replace />;
}
