import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/profile/ProfileView";
import { NewOwnProfile } from '@/components/redesign/NewOwnProfile';
import { useAppVersion } from '@/hooks/use-app-version';
import { isNewProfileVisit, ownNewProfileOptions } from '@/components/redesign/profile-query';
import { parseProfileTab, type ProfileTab } from '@/components/redesign/NewProfileParts';

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: (search: Record<string, unknown>): { tab?: ProfileTab } => { const tab = parseProfileTab(search['tab']); return tab ? { tab } : {}; },
  loader: async ({ context }) => { if (await isNewProfileVisit(context.queryClient)) await context.queryClient.ensureQueryData(ownNewProfileOptions); },
  head: () => ({ meta: [{ title: 'Your profile · Pactara' }, { name: 'description', content: 'Your Pactara check-ins, crew goals and weekly progress.' }, { property: 'og:title', content: 'Your profile · Pactara' }, { property: 'og:description', content: 'Your Pactara check-ins, crew goals and weekly progress.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const version = useAppVersion();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return version === 'new' ? <NewOwnProfile tab={tab ?? 'posts'} onTab={t => void navigate({ search: t === 'posts' ? {} : { tab: t }, replace: true })} /> : <ProfileView />;
}
