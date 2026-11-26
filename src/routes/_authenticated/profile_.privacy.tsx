import { createFileRoute, redirect } from '@tanstack/react-router';
import { NewProfilePrivacy, privacySettingsOptions } from '@/components/redesign/NewProfilePrivacy';
import { isNewProfileVisit } from '@/components/redesign/profile-query';

export const Route = createFileRoute('/_authenticated/profile_/privacy')({
  beforeLoad: async ({ context }) => { if (!await isNewProfileVisit(context.queryClient)) throw redirect({ to: '/account-settings' }); },
  loader: ({ context }) => context.queryClient.ensureQueryData(privacySettingsOptions),
  head: () => ({ meta: [{ title: 'Account privacy · Pactara' }, { name: 'description', content: 'Choose whether your Pactara profile is private or public.' }, { property: 'og:title', content: 'Account privacy · Pactara' }, { property: 'og:description', content: 'Choose whether your Pactara profile is private or public.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: NewProfilePrivacy,
});