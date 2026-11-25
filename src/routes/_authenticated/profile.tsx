import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/profile/ProfileView";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: 'Your profile · Pactara' }, { name: 'description', content: 'Your Pactara check-ins, crew goals and weekly progress.' }, { property: 'og:title', content: 'Your profile · Pactara' }, { property: 'og:description', content: 'Your Pactara check-ins, crew goals and weekly progress.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ProfilePage,
});

function ProfilePage() {
  return <ProfileView />;
}
