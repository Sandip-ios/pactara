import { createFileRoute } from '@tanstack/react-router';
import { NewSaved } from '@/components/redesign/NewSaved';

export const Route = createFileRoute('/_authenticated/saved')({
  head: () => ({ meta: [{ title: 'Saved · Pactara' }, { name: 'description', content: 'Posts and check-ins you saved on Pactara. Only you can see them.' }, { property: 'og:title', content: 'Saved · Pactara' }, { property: 'og:description', content: 'Posts and check-ins you saved on Pactara.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: NewSaved,
});
