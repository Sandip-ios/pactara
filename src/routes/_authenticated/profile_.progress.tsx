import { createFileRoute, redirect } from '@tanstack/react-router';
import { NewProfileProgress, profileProgressOptions } from '@/components/redesign/NewProfileProgress';
import { isNewProfileVisit } from '@/components/redesign/profile-query';

export const Route = createFileRoute('/_authenticated/profile_/progress')({
  beforeLoad: async ({ context }) => { if (!await isNewProfileVisit(context.queryClient)) throw redirect({ to: '/profile' }); },
  loader: ({ context }) => context.queryClient.ensureQueryData(profileProgressOptions()),
  head: () => ({ meta: [{ title: 'Your progress · Pactara' }, { name: 'description', content: 'Your Pactara streak, workouts, monthly calendar and streak badges.' }, { property: 'og:title', content: 'Your progress · Pactara' }, { property: 'og:description', content: 'Your Pactara streak, workouts, monthly calendar and streak badges.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: NewProfileProgress,
});
