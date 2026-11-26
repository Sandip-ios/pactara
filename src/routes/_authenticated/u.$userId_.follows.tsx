import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useAppVersion } from '@/hooks/use-app-version';
import { NewSocialList } from '@/components/redesign/NewSocialList';
import { socialListOptions } from '@/components/redesign/social-query';
import { isNewProfileVisit } from '@/components/redesign/profile-query';

export const Route = createFileRoute('/_authenticated/u/$userId_/follows')({
  validateSearch: (search: Record<string, unknown>): { socialTab: 'followers' | 'following' } => ({ socialTab: search['socialTab'] === 'following' ? 'following' : 'followers' }),
  loaderDeps: ({ search }) => ({ tab: search.socialTab }),
  loader: async ({ context, params, deps }) => { if (await isNewProfileVisit(context.queryClient)) await context.queryClient.ensureQueryData(socialListOptions(params.userId, deps.tab)); },
  head: () => ({ meta: [{ title: 'Followers and following · Pactara' }, { name: 'description', content: 'Find the people connected to a Pactara profile.' }, { property: 'og:title', content: 'Followers and following · Pactara' }, { property: 'og:description', content: 'Find the people connected to a Pactara profile.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: SocialRoute,
});
function SocialRoute() {
  const version = useAppVersion(); const { userId } = Route.useParams(); const { socialTab } = Route.useSearch(); const navigate = Route.useNavigate();
  return version === 'new' ? <NewSocialList key={`${userId}:${socialTab}`} target={userId} tab={socialTab} onTab={tab => void navigate({ search: { socialTab: tab }, replace: true })} /> : <Navigate to="/profile" replace />;
}