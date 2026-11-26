import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery, type QueryKey } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getBlockedPeople, setUserBlock } from '@/lib/safety.functions';
import { BLOCKING_EXPLAINER, blockedOnLabel } from '@/lib/redesign-profile';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { NewConfirm } from './NewConfirm';
import { SocialAvatar } from './NewSocialBits';

type Person = Awaited<ReturnType<typeof getBlockedPeople>>[number];

export function NewBlockedPeople({ queryKey }: { queryKey: QueryKey }) {
  const { data: people } = useSuspenseQuery({ queryKey, queryFn: () => getBlockedPeople() });
  const qc = useQueryClient(); const unblock = useServerFn(setUserBlock);
  const [target, setTarget] = useState<Person | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const scroll = useOpenAtTop(); useHideBottomTabs(true, false);
  const display = (p: Person) => p.name && p.name !== 'Member' ? p.name : p.username || 'Member';
  const first = (p: Person) => display(p).trim().split(/\s+/)[0] || 'Member';
  const confirm = async () => {
    if (!target || busy) return; setBusy(true); setError(null);
    try {
      await unblock({ data: { userId: target.id, blocked: false } });
      qc.setQueryData(queryKey, (old: Person[] | undefined) => old?.filter(p => p.id !== target.id) ?? []);
      await Promise.all(['safety', 'new-member-profile', 'feed', 'group-feed'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(`${first(target)} unblocked`); setTarget(null);
    } catch (e) { const m = e instanceof Error ? e.message : 'Please try again.'; setError(m); toast.error(m); }
    finally { setBusy(false); }
  };
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-privacy-page fixed inset-0 overflow-y-auto overscroll-none pb-10">
    <header className="new-profile-header pt-new-top"><div className="new-profile-header-row"><Button variant="ghost" asChild className="new-profile-menu-button"><Link to="/profile" aria-label="Back"><ChevronLeft size={22} /></Link></Button><h1>Blocked people</h1><span className="new-profile-header-spacer" /></div></header>
    <p className="new-social-private-strip">{BLOCKING_EXPLAINER}</p>
    {people.length ? people.map(p => <div key={p.id} className="new-blocked-row">
      <SocialAvatar url={p.avatarUrl} size={48} />
      <span className="new-blocked-copy"><strong>{display(p)}</strong><small>{blockedOnLabel(p.blockedAt)}</small></span>
      <Button variant="ghost" className="new-blocked-unblock" onClick={() => { setError(null); setTarget(p); }}>Unblock</Button>
    </div>) : <p className="new-blocked-empty">You haven't blocked anyone.</p>}
    <p className="new-blocked-footer">To block someone, open their profile and tap •••.</p>
    <NewConfirm open={Boolean(target)} onOpenChange={o => { if (!o) setTarget(null); }} tone="primary" title={`Unblock ${target ? first(target) : ''}?`} subtitle="They'll be able to see your profile and follow you again. You won't follow each other automatically." action="Unblock" busy={busy} error={error} onConfirm={() => void confirm()} />
  </div>;
}
