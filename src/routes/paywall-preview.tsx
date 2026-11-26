import { createFileRoute } from "@tanstack/react-router";
import { TrialEndedPaywall } from "@/components/TrialEndedPaywall";

export const Route = createFileRoute("/paywall-preview")({
  head: () => ({ meta: [{ title: 'Membership preview · Pactara' }, { name: 'description', content: 'Preview Pactara membership options.' }, { property: 'og:title', content: 'Membership preview · Pactara' }, { property: 'og:description', content: 'Preview Pactara membership options.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  ssr: false,
  component: () => (
    <TrialEndedPaywall firstName="Alex" mode="intro" onDismiss={() => {}} />
  ),
});
