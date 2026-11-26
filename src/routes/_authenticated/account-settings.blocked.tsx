import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedAvatar } from '@/components/feed/FeedMedia';
import { UnblockButton } from '@/components/safety/SafetyActions';
import { getBlockedPeople } from '@/lib/safety.functions';
import { useAppVersion } from '@/hooks/use-app-version';

const blockedPeopleQuery = queryOptions({ queryKey: ['safety', 'people'], queryFn: () => getBlockedPeople() });

export const Route = createFileRoute('/_authenticated/account-settings/blocked')({
  loader: ({ context }) => context.queryClient.ensureQueryData(blockedPeopleQuery),
  head: () => ({ meta: [
    { title: 'Blocked people · Pactara' }, { name: 'description', content: 'Manage your private blocked people list in Pactara.' },
    { property: 'og:title', content: 'Blocked people · Pactara' }, { property: 'og:description', content: 'Manage your private blocked people list in Pactara.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: BlockedPeople,
});

function BlockedPeople() {
  const { data: people } = useSuspenseQuery(blockedPeopleQuery);
  const qc = useQueryClient();
  const version = useAppVersion();
  return <div className={`fixed inset-0 overflow-y-auto overscroll-none bg-health-surface ${version === 'new' ? 'pb-[max(24px,env(safe-area-inset-bottom))]' : 'pb-28'}`}>
    <header className={`flex items-center gap-2 bg-card px-4 ${version === 'new' ? 'pt-new-top' : 'pt-safe-5'} pb-4`}>
      <Button variant="ghost" size="icon" asChild className="rounded-full"><Link to="/account-settings" aria-label="Back"><ChevronLeft size={22} /></Link></Button>
      <h1 className="text-[18px] font-bold">Blocked people</h1>
    </header>
    <section className="px-5 pt-5">
      {people.length ? <ul className="overflow-hidden rounded-2xl bg-card">{people.map(p => <li key={p.id} className="flex items-center gap-3 border-b border-border/40 px-4 py-4 last:border-0">
        <FeedAvatar name={p.name} url={p.avatarUrl} color={p.avatarColor} size={40} />
        <span className="min-w-0 flex-1 truncate text-[16px] font-bold">{p.name}</span>
        <UnblockButton userId={p.id} name={p.name} onUnblocked={() => qc.setQueryData(blockedPeopleQuery.queryKey, (old: typeof people | undefined) => old?.filter(person => person.id !== p.id) ?? [])} />
      </li>)}</ul> : <p className="py-12 text-center text-[15px] text-muted-foreground">You haven't blocked anyone.</p>}
    </section>
  </div>;
}