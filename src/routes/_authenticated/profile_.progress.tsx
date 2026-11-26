import { createFileRoute, redirect } from '@tanstack/react-router';
import { NewProfileProgress, profileProgressOptions } from '@/components/redesign/NewProfileProgress';
import { isNewProfileVisit } from '@/components/redesign/profile-query';

export const Route = createFileRoute('/_authenticated/profile_/progress')({
  beforeLoad: async ({ context }) => { if (!await isNewProfileVisit(context.queryClient)) throw redirect({ to: '/profile' }); },
  validateSearch: (input: Record<string, unknown>): { group?: string } => typeof input['group'] === 'string' ? { group: input['group'] } : {},
  loaderDeps: ({ search }) => ({ group: search.group ?? null }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(profileProgressOptions(deps.group)),
  head: () => ({ meta: [{ title: 'Your progress · Pactara' }, { name: 'description', content: 'Your Pactara streak badges and crew workout progress.' }, { property: 'og:title', content: 'Your progress · Pactara' }, { property: 'og:description', content: 'Your Pactara streak badges and crew workout progress.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: () => <NewProfileProgress group={Route.useSearch().group ?? null} />,
});