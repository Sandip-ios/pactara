import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NewPactDone } from "@/components/redesign/NewPactDone";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";

export const Route = createFileRoute("/_authenticated/crews/$groupId_/pact-done")({
  head: () => ({ meta: [
    { title: "Pact done · Pactara" },
    { name: "description", content: "See how your crew showed up over the pact you just finished." },
    { property: "og:title", content: "Pact done · Pactara" },
    { property: "og:description", content: "See how your crew showed up over the pact you just finished." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PactDoneRoute,
});

function PactDoneRoute() {
  const version = useAppVersion(), prefs = useAppPrefs(), { groupId } = Route.useParams();
  if (!prefs.isSuccess) return null;
  return version === "new" ? <NewPactDone groupId={groupId} /> : <Navigate to="/groups/$groupId" params={{ groupId }} replace />;
}
