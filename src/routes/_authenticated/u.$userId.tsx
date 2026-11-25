import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProfileView } from "@/components/profile/ProfileView";

export const Route = createFileRoute("/_authenticated/u/$userId")({
  head: () => ({ meta: [{ title: 'Crew member profile · Pactara' }, { name: 'description', content: 'A crewmate’s Pactara check-ins and weekly progress.' }, { property: 'og:title', content: 'Crew member profile · Pactara' }, { property: 'og:description', content: 'A crewmate’s Pactara check-ins and weekly progress.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: MemberProfilePage,
});

function MemberProfilePage() {
  const { userId } = useParams({ from: "/_authenticated/u/$userId" });
  return <ProfileView userId={userId} />;
}
