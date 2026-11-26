import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useAppVersion } from '@/hooks/use-app-version';
import { NewActivity } from '@/components/redesign/NewActivity';
import { activityOptions } from '@/components/redesign/social-query';
import { isNewProfileVisit } from '@/components/redesign/profile-query';

export const Route = createFileRoute('/_authenticated/activity')({
  loader: async ({ context }) => { if (await isNewProfileVisit(context.queryClient)) await context.queryClient.ensureQueryData(activityOptions); },
  head: () => ({ meta: [{ title: 'Activity · Pactara' }, { name: 'description', content: 'Your crew updates, follows and requests on Pactara.' }, { property: 'og:title', content: 'Activity · Pactara' }, { property: 'og:description', content: 'Your crew updates, follows and requests on Pactara.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: () => useAppVersion() === 'new' ? <NewActivity /> : <Navigate to="/notifications" replace />,
});