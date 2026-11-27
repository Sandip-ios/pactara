import { createFileRoute } from "@tanstack/react-router";
import { parseProfileTab, type ProfileTab } from "@/components/redesign/NewProfileParts";
import { ProfileView } from "@/components/profile/ProfileView";
import { NewMemberProfile, memberProfileOptions } from "@/components/redesign/NewMemberProfile";
import { isNewProfileVisit } from "@/components/redesign/profile-query";
import { useAppVersion } from "@/hooks/use-app-version";

// $userId is a member id (classic and new) or, in the new version, a username.
export const Route = createFileRoute("/_authenticated/u/$userId")({
  validateSearch: (search: Record<string, unknown>): { tab?: ProfileTab } => { const tab = parseProfileTab(search['tab']); return tab ? { tab } : {}; },
  // Not awaited: the new profile shows its own loading and "Couldn't load" states.
  loader: async ({ context, params }) => { if (await isNewProfileVisit(context.queryClient)) void context.queryClient.prefetchQuery(memberProfileOptions(params.userId)); },
  head: () => ({ meta: [{ title: 'Crew member profile · Pactara' }, { name: 'description', content: 'A crewmate’s Pactara check-ins and weekly progress.' }, { property: 'og:title', content: 'Crew member profile · Pactara' }, { property: 'og:description', content: 'A crewmate’s Pactara check-ins and weekly progress.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: MemberProfilePage,
});

function MemberProfilePage() {
  const { userId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const version = useAppVersion();
  return version === 'new' ? <NewMemberProfile key={userId} target={userId} tab={tab ?? 'posts'} onTab={t => void navigate({ search: t === 'posts' ? {} : { tab: t }, replace: true })} /> : <ProfileView userId={userId} />;
}
