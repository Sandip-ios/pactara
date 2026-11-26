import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useAppVersion } from '@/hooks/use-app-version';
import { NewFollowRequests } from '@/components/redesign/NewFollowRequests';
import { socialListOptions } from '@/components/redesign/social-query';
import { isNewProfileVisit } from '@/components/redesign/profile-query';

export const Route = createFileRoute('/_authenticated/follow-requests')({
  loader: async ({ context }) => { if (await isNewProfileVisit(context.queryClient)) await context.queryClient.ensureQueryData(socialListOptions(context.user.id, 'requests')); },
  head: () => ({ meta: [{ title: 'Follow requests · Pactara' }, { name: 'description', content: 'Confirm who can follow your private Pactara profile.' }, { property: 'og:title', content: 'Follow requests · Pactara' }, { property: 'og:description', content: 'Confirm who can follow your private Pactara profile.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: () => useAppVersion() === 'new' ? <NewFollowRequests /> : <Navigate to="/profile" replace />,
});