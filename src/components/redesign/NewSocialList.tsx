import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useRouteContext } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { followUser, removeFollower, unfollowUser } from '@/lib/follows.functions';
import { getSocialList } from '@/lib/profile-social.functions';
import { SOCIAL_PAGE_SIZE, socialFollowAction, type SocialPerson } from '@/lib/profile-social';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { useStatusBarScrollToTop } from '@/lib/status-bar-scroll';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { socialListOptions } from './social-query';
import { SocialAvatar, SocialHeader } from './NewSocialBits';
import { NewConfirm } from './NewConfirm';
import { NewSheet, NewSheetRow } from './NewSheet';

export function NewSocialList({ target, tab, onTab }: { target: string; tab: 'followers' | 'following'; onTab: (tab: 'followers' | 'following') => void }) {
  const { user } = useRouteContext({ from: '/_authenticated' });
  const { data: first } = useSuspenseQuery(socialListOptions(target, tab));
  const [search, setSearch] = useState(''); const [query, setQuery] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 200); return () => clearTimeout(timer); }, [search]);
  const pages = useInfiniteQuery({ queryKey: ['social-list-pages', target, tab, query], initialPageParam: 0, queryFn: ({ pageParam }) => getSocialList({ data: { target, direction: tab, search: query, offset: pageParam } }), getNextPageParam: (last, all) => last.hasMore ? all.length * SOCIAL_PAGE_SIZE : undefined, ...(query ? {} : { initialData: { pages: [first], pageParams: [0] } }) });
  const people = pages.data?.pages.flatMap(p => p.people) ?? [];
  const own = target === user.id; const navigate = useNavigate(); const qc = useQueryClient();
  const [remove, setRemove] = useState<SocialPerson | null>(null); const [sheet, setSheet] = useState<SocialPerson | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const follow = useServerFn(followUser); const unfollow = useServerFn(unfollowUser); const removeFn = useServerFn(removeFollower);
  useHideBottomTabs(Boolean(remove || sheet)); const scroll = useOpenAtTop(); useStatusBarScrollToTop();
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return; setBusy(true); setError(null);
    try { await action(); setRemove(null); setSheet(null); await Promise.all(['social-list', 'social-list-pages', 'new-own-profile', 'new-member-profile', 'new-activity', 'new-activity-unread'].map(key => qc.invalidateQueries({ queryKey: [key] }))); }
    catch (e) { const message = e instanceof Error ? e.message : 'Please try again.'; setError(message); toast.error(message); }
    finally { setBusy(false); }
  };
  const followControl = (p: SocialPerson) => {
    const action = socialFollowAction(p); if (!action) return null;
    return <Button variant="ghost" disabled={busy} className={`new-social-action ${action === 'Follow' ? 'primary' : 'quiet'}`} onClick={() => action === 'Follow' ? void run(() => follow({ data: { target: p.id } })) : setSheet(p)}>{action}</Button>;
  };
  const firstName = (p: SocialPerson) => p.name.trim().split(/\s+/)[0] || p.username || 'Member';
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-social-page fixed inset-0 overflow-y-auto overscroll-none pb-[calc(104px+env(safe-area-inset-bottom))]">
    <SocialHeader title={first.profile.username || first.profile.name} />
    <div className="new-social-tabs" role="tablist" aria-label="Profile connections">{(['followers', 'following'] as const).map(direction => <Button key={direction} variant="ghost" role="tab" aria-selected={tab === direction} className={tab === direction ? 'active' : ''} onClick={() => { setSearch(''); setQuery(''); onTab(direction); }}>{direction === 'followers' ? first.profile.follower_count : first.profile.following_count} {direction}</Button>)}</div>
    <label className="new-social-search"><Search size={18} aria-hidden /><input aria-label="Search" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} /></label>
    {pages.isError && <div className="new-social-empty" role="alert">Couldn't load this list. <Button variant="ghost" onClick={() => void pages.refetch()}>Try again</Button></div>}
    {pages.isFetching && !people.length ? <p className="new-social-empty">Loading…</p> : !people.length && !pages.isError ? <p className="new-social-empty">{query ? 'No matches.' : tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p> : null}
    {people.map(p => <div className="new-social-row" key={p.id}>
      <Button variant="ghost" className="new-social-person" onClick={() => void navigate({ to: '/u/$userId', params: { userId: p.username || p.id } })}><SocialAvatar url={p.avatar} size={48} /><span className="new-social-person-copy"><strong>{p.name}</strong><small>{p.username || ''}{p.sharedCrew ? ` · ${p.sharedCrew}` : ''}</small></span></Button>
      <div className="new-social-actions">{own && tab === 'followers' ? <>{p.canFollow && !['following', 'requested'].includes(p.relationship) && followControl(p)}<Button variant="ghost" disabled={busy} className="new-social-action quiet" onClick={() => { setError(null); setRemove(p); }}>Remove</Button></> : followControl(p)}</div>
    </div>)}
    {pages.hasNextPage && <Button variant="ghost" className="new-social-more" disabled={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>{pages.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button>}
    {own && tab === 'followers' && <p className="new-social-footer">Removing someone doesn't tell them. On a private account they'd need to request again to see your profile.</p>}
    <NewConfirm open={Boolean(remove)} onOpenChange={open => { if (!open) setRemove(null); }} title={`Remove ${remove ? firstName(remove) : ''}?`} subtitle={`${remove ? firstName(remove) : ''} won't be told.`} action="Remove" busy={busy} error={error} onConfirm={() => { if (remove) void run(() => removeFn({ data: { follower: remove.id } })); }} />
    <NewSheet open={Boolean(sheet)} onOpenChange={open => { if (!open) setSheet(null); }} title={sheet?.relationship === 'requested' ? 'Cancel follow request?' : 'Following'} hideTitle={sheet?.relationship !== 'requested'}><NewSheetRow simple destructive title={sheet?.relationship === 'requested' ? 'Cancel request' : 'Unfollow'} disabled={busy} onClick={() => { if (sheet) void run(() => unfollow({ data: { target: sheet.id } })); }} /></NewSheet>
  </div>;
}