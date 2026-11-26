import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProfileView } from "@/components/profile/ProfileView";
import { NewMemberProfile, memberProfileOptions } from "@/components/redesign/NewMemberProfile";
import { isNewProfileVisit } from "@/components/redesign/profile-query";
import { useAppVersion } from "@/hooks/use-app-version";

// $userId is a member id (classic and new) or, in the new version, a username.
export const Route = createFileRoute("/_authenticated/u/$userId")({
  loader: async ({ context, params }) => { if (await isNewProfileVisit(context.queryClient)) await context.queryClient.ensureQueryData(memberProfileOptions(params.userId)); },
  head: () => ({ meta: [{ title: 'Crew member profile · Pactara' }, { name: 'description', content: 'A crewmate’s Pactara check-ins and weekly progress.' }, { property: 'og:title', content: 'Crew member profile · Pactara' }, { property: 'og:description', content: 'A crewmate’s Pactara check-ins and weekly progress.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: MemberProfilePage,
});

function MemberProfilePage() {
  const { userId } = useParams({ from: "/_authenticated/u/$userId" });
  const version = useAppVersion();
  return version === 'new' ? <NewMemberProfile key={userId} target={userId} /> : <ProfileView userId={userId} />;
}
