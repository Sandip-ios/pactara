import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/profile/ProfileView";
import { NewOwnProfile } from '@/components/redesign/NewOwnProfile';
import { useAppVersion } from '@/hooks/use-app-version';
import { isNewProfileVisit, ownNewProfileOptions } from '@/components/redesign/profile-query';

export const Route = createFileRoute("/_authenticated/profile")({
  loader: async ({ context }) => { if (await isNewProfileVisit(context.queryClient)) await context.queryClient.ensureQueryData(ownNewProfileOptions); },
  head: () => ({ meta: [{ title: 'Your profile · Pactara' }, { name: 'description', content: 'Your Pactara check-ins, crew goals and weekly progress.' }, { property: 'og:title', content: 'Your profile · Pactara' }, { property: 'og:description', content: 'Your Pactara check-ins, crew goals and weekly progress.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const version = useAppVersion();
  return version === 'new' ? <NewOwnProfile /> : <ProfileView />;
}
