import { useState } from 'react';
import { useInfiniteQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useRouteContext } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { followUser, respondFollowRequest } from '@/lib/follows.functions';
import { getSocialList } from '@/lib/profile-social.functions';
import { SOCIAL_PAGE_SIZE, type SocialPerson } from '@/lib/profile-social';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { useStatusBarScrollToTop } from '@/lib/status-bar-scroll';
import { socialListOptions } from './social-query';
import { SocialAvatar, SocialHeader } from './NewSocialBits';

export function NewFollowRequests() {
  const { user } = useRouteContext({ from: '/_authenticated' });
  const { data: first } = useSuspenseQuery(socialListOptions(user.id, 'requests'));
  const pages = useInfiniteQuery({ queryKey: ['social-request-pages', user.id], initialPageParam: 0, queryFn: ({ pageParam }) => getSocialList({ data: { target: user.id, direction: 'requests', offset: pageParam, search: '' } }), getNextPageParam: (last, all) => last.hasMore ? all.length * SOCIAL_PAGE_SIZE : undefined, initialData: { pages: [first], pageParams: [0] } });
  const [confirmed, setConfirmed] = useState<SocialPerson[]>([]); const [busy, setBusy] = useState(false);
  const qc = useQueryClient(); const navigate = useNavigate(); const respond = useServerFn(respondFollowRequest); const follow = useServerFn(followUser);
  const scroll = useOpenAtTop(); useStatusBarScrollToTop();
  const refresh = () => Promise.all(['social-list', 'social-request-pages', 'social-list-pages', 'new-own-profile', 'new-member-profile', 'new-activity', 'new-activity-unread', 'unread-notification-count'].map(key => qc.invalidateQueries({ queryKey: [key] })));
  const decision = async (person: SocialPerson, accept: boolean) => {
    if (busy) return; setBusy(true);
    try { const result = await respond({ data: { follower: person.id, accept } });
      if (accept && (result as { changed?: boolean }).changed && person.canFollow && !['following', 'requested'].includes(person.relationship)) setConfirmed(old => [...old.filter(p => p.id !== person.id), person]);
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  };
  const pending = pages.data?.pages.flatMap(p => p.people) ?? [];
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-social-page fixed inset-0 overflow-y-auto overscroll-none pb-[calc(104px+env(safe-area-inset-bottom))]">
    <SocialHeader title="Follow requests" />
    <p className="new-social-private-strip">Your account is private. Only people you confirm can see your progress.</p>
    {[...confirmed, ...pending.filter(p => !confirmed.some(c => c.id === p.id))].map(person => <div className="new-social-row" key={person.id}>
      <Button variant="ghost" className="new-social-person" onClick={() => void navigate({ to: '/u/$userId', params: { userId: person.username || person.id } })}><SocialAvatar url={person.avatar} size={48} /><span className="new-social-person-copy"><strong>{person.name}</strong><small>{person.username || ''}</small></span></Button>
      <div className="new-social-actions">{confirmed.some(p => p.id === person.id) ? <Button variant="ghost" disabled={busy} className="new-social-action primary" onClick={async () => { if (busy) return; setBusy(true); try { await follow({ data: { target: person.id } }); setConfirmed(old => old.filter(p => p.id !== person.id)); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } }}>Follow back</Button> : <><Button variant="ghost" disabled={busy} className="new-social-action primary" onClick={() => void decision(person, true)}>Confirm</Button><Button variant="ghost" disabled={busy} className="new-social-action quiet" onClick={() => void decision(person, false)}>Delete</Button></>}</div>
    </div>)}
    {pages.isError && <p className="new-social-empty" role="alert">Couldn't load requests. <Button variant="ghost" onClick={() => void pages.refetch()}>Try again</Button></p>}
    {!pending.length && !confirmed.length && !pages.isError && <p className="new-social-empty">No follow requests.</p>}
    {pages.hasNextPage && <Button variant="ghost" className="new-social-more" disabled={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>Load more</Button>}
    <p className="new-social-footer">Deleting a request doesn't tell them. They can ask again later.</p>
  </div>;
}