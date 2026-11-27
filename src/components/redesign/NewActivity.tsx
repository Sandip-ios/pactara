import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useRouteContext, useRouter, useRouterState } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ChevronRight, Flame, Image as ImageIcon, Play } from 'lucide-react';
import { newToastApi as toast } from "./new-toast";
import { Button } from '@/components/ui/button';
import { markNotificationsRead } from '@/lib/notifications.functions';
import { followUser } from '@/lib/follows.functions';
import { activityReadBatches, activitySection, activityTime, requestSummary } from '@/lib/profile-social';
import { groupActivityRows, type ActivityDisplayRow, type ActivityRow } from '@/lib/activity-groups';
import { ACTIVITY_UNAVAILABLE, withActivityReturn, type ActivityDeepLinkKind } from '@/lib/activity-deeplink';
import { resolveActivityDeepLink } from '@/lib/activity-deeplink.functions';
import { syncAppBadge } from '@/lib/badge-client';
import { beginNewCheckIn } from '@/lib/redesign-checkin';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { useStatusBarScrollToTop } from '@/lib/status-bar-scroll';
import { activityOptions } from './social-query';
import { SocialAvatar, SocialHeader } from './NewSocialBits';
import { CrewAvatarOverlap } from './CrewAvatars';

function ActivityCopy({ row }: { row: ActivityDisplayRow }) {
  const hideActor = row.kind === 'reminder' || row.kind === 'pact_complete' || row.kind === 'crew_approved';
  const actorLabel = row.grouped ? row.groupActorLabel ?? '' : row.name;
  const text = row.grouped
    ? (row.groupText ?? '').slice(actorLabel.length).trimStart()
    : row.kind.startsWith('follow') ? row.text.replace(/^\S+\s+/, '') : row.text;
  const index = row.groupName ? text.indexOf(row.groupName) : -1;
  return <span>{!hideActor && <><strong>{actorLabel}</strong>{' '}</>}{index >= 0 ? <>{text.slice(0, index)}<strong>{row.groupName}</strong>{text.slice(index + row.groupName.length)}</> : text}</span>;
}

function ActivityThumbnail({ row, onOpen }: { row: ActivityDisplayRow; onOpen: () => void }) {
  const [failed, setFailed] = useState<string | null>(null);
  const hasImage = row.media && row.media !== failed && row.mediaKind !== 'video';
  return <Button variant="ghost" className="new-activity-thumbnail" aria-label={`Open ${row.name}'s post`} onClick={onOpen}>{hasImage ? <img src={row.media ?? ''} alt="" onError={() => setFailed(row.media)} /> : row.mediaKind === 'video' || row.media?.includes('.poster.jpg') ? <Play size={18} aria-hidden /> : <ImageIcon size={18} aria-hidden />}</Button>;
}

export function NewActivity() {
  const { data } = useSuspenseQuery(activityOptions);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const mark = useServerFn(markNotificationsRead);
  const follow = useServerFn(followUser);
  const resolve = useServerFn(resolveActivityDeepLink);
  const [busy, setBusy] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const scroll = useOpenAtTop();
  const activityIndex = useRouterState({ select: state => state.location.state.__TSR_index });
  const mountedActivityIndex = useRef(activityIndex);
  // Some destination loaders render after the router's own scroll restoration.
  // Resume only the same Activity history entry; a fresh Activity visit starts at top.
  useLayoutEffect(() => {
    let frame: number | null = null;
    const restore = (freshMount = false) => {
      try {
        const saved = JSON.parse(sessionStorage.getItem('activity-return-scroll') ?? 'null') as { index: number; top: number } | null;
        if (!saved || saved.index !== mountedActivityIndex.current) {
          if (freshMount) sessionStorage.removeItem('activity-return-scroll');
          return;
        }
        sessionStorage.removeItem('activity-return-scroll');
        frame = requestAnimationFrame(() => scroll.current?.scrollTo(0, saved.top));
      } catch { /* private mode */ }
    };
    restore(true);
    const unsubscribe = router.subscribe('onRendered', event => {
      if (event.toLocation.state.__TSR_index === mountedActivityIndex.current) restore();
    });
    return () => { unsubscribe(); if (frame !== null) cancelAnimationFrame(frame); };
  }, [router, scroll]);
  useStatusBarScrollToTop();
  const submitted = useRef(new Set<string>());
  const { user } = useRouteContext({ from: '/_authenticated' });
  const allRows: ActivityRow[] = [
    ...data.crew.map(i => ({ key: i.key, kind: i.kind, actorId: i.actorId, name: i.actorName, avatar: i.actorAvatarUrl, text: i.text, createdAt: i.createdAt, read: i.read, groupId: i.groupId, groupName: i.groupName, postId: i.postId, commentId: i.commentId, checkInId: i.checkInId ?? null, targetId: null, media: i.mediaUrl, mediaKind: i.mediaKind, canFollow: false, canCheckIn: false, relationship: 'none' })),
    ...data.follows.map(i => ({ ...i, kind: i.kind as ActivityDeepLinkKind, name: i.actorName, groupId: null, groupName: '', postId: null, commentId: null, targetId: null, media: null, mediaKind: null, canCheckIn: false })),
    ...data.items.map(i => ({ ...i, name: i.actorName, postId: null, commentId: null, targetId: i.targetId ?? null, media: null, mediaKind: null, canFollow: false, relationship: 'none' })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  // Own actions and individual pending follow requests never show as rows; the summary row covers the latter.
  const rows = groupActivityRows(allRows.filter(r => (r.actorId !== user.id || r.kind === 'reminder' || r.kind === 'pact_complete') && r.kind !== 'follow_request'));
  const unread = allRows.filter(i => !i.read).map(i => i.key).join('|');
  useEffect(() => {
    const keys = unread.split('|').filter(key => key && !submitted.current.has(key));
    if (!keys.length) return;
    keys.forEach(key => submitted.current.add(key));
    void Promise.all(activityReadBatches(keys).map(batch => mark({ data: { keys: batch } }))).then(async () => {
      await Promise.all(['new-activity', 'new-activity-unread', 'unread-notification-count', 'notifications'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      await syncAppBadge();
    }).catch(() => {
      keys.forEach(key => submitted.current.delete(key));
      toast.error('Could not mark Activity read. Try opening it again.');
    });
  }, [unread, mark, qc]);

  const open = async (row: ActivityDisplayRow, kind: ActivityDeepLinkKind = row.kind, actorId = row.actorId, profileOnly = false) => {
    if (opening) return;
    setOpening(row.key);
    try {
      if (row.grouped && row.kind === 'follow' && !profileOnly) {
        try { sessionStorage.setItem('activity-return-scroll', JSON.stringify({ index: activityIndex, top: scroll.current?.scrollTop ?? 0 })); } catch { /* private mode */ }
        await navigate({ href: `/u/${user.id}/follows?socialTab=followers` });
        return;
      }
      const destination = await resolve({ data: {
        kind, groupId: row.groupId, postId: row.postId, commentId: row.commentId,
        actorId, requestId: row.targetId, checkInId: row.checkInId ?? null,
      } });
      if (destination.checkInGroupId) {
        try { sessionStorage.setItem('activity-return-scroll', JSON.stringify({ index: activityIndex, top: scroll.current?.scrollTop ?? 0 })); } catch { /* private mode */ }
        beginNewCheckIn(destination.checkInGroupId, null, true);
        await navigate({ href: `/check-in?group=${destination.checkInGroupId}` });
        return;
      }
      if (!destination.href) {
        toast.error(ACTIVITY_UNAVAILABLE);
        return;
      }
      try { sessionStorage.setItem('activity-return-scroll', JSON.stringify({ index: activityIndex, top: scroll.current?.scrollTop ?? 0 })); } catch { /* private mode */ }
      await navigate({ href: withActivityReturn(destination.href) });
    } catch {
      toast.error(ACTIVITY_UNAVAILABLE);
    } finally {
      setOpening(null);
    }
  };

  const firstPending = data.pending[0];
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-social-page fixed inset-0 overflow-y-auto overscroll-none pb-[calc(104px+env(safe-area-inset-bottom))]">
    <SocialHeader title="Activity" />
    {data.isPrivate && firstPending && <Button variant="ghost" className="new-activity-requests" onClick={() => void navigate({ to: '/follow-requests' })}>
      <CrewAvatarOverlap members={data.pending.map(p => ({ id: p.id, name: p.name, avatarUrl: p.avatar, avatarColor: '' }))} size={32} limit={2} />
      <span className="new-social-person-copy"><strong>Follow requests</strong><small>{requestSummary(firstPending.name.trim().split(/\s+/)[0] || firstPending.username || 'Member', data.pendingCount)}</small></span><span className="new-activity-dot" /><ChevronRight size={20} className="text-[var(--new-chevron)]" />
    </Button>}
    {!rows.length && <p className="new-social-empty">No activity yet.</p>}
    {(['TODAY', 'THIS WEEK', 'EARLIER'] as const).map(section => {
      const items = rows.filter(i => activitySection(i.createdAt) === section);
      if (!items.length) return null;
      return <section key={section}><h2 className="new-activity-section">{section}</h2>{items.map(row => <div className="new-activity-row" key={row.key}>
        <div className="new-activity-content">
          {row.kind === 'reminder'
            ? <Button variant="ghost" className="new-activity-avatar" aria-label="Open check-in reminder" onClick={() => void open(row)}><span className="new-activity-icon"><Flame size={20} /></span></Button>
            : row.groupKind === 'people'
              ? <div className="new-activity-group-avatars">{row.actors.slice(0, 2).map(actor => <Button key={actor.id} variant="ghost" className="new-activity-group-avatar" aria-label={actor.id === user.id ? 'Your profile' : `${actor.name}'s profile`} onClick={() => void open(row, 'follow', actor.id, true)}><SocialAvatar url={actor.avatar} size={28} /></Button>)}</div>
              : <Button variant="ghost" className="new-activity-avatar" aria-label={row.actorId === user.id ? 'Your profile' : `${row.name}'s profile`} onClick={() => void open(row, 'follow')}><SocialAvatar url={row.avatar} size={40} /></Button>}
          <Button variant="ghost" className="new-activity-open" disabled={opening === row.key} onClick={() => void open(row)}>
            <span className="new-activity-copy"><ActivityCopy row={row} /><small>{activityTime(row.createdAt)}{row.grouped && row.kind === 'checkin' ? ` · ${row.groupName}` : ''}</small></span>
          </Button>
        </div>
        {row.kind === 'crew_request'
          ? <Button variant="ghost" className="new-activity-pill primary" onClick={() => void open(row)}>Review</Button>
          : row.kind === 'follow' && !row.grouped && row.canFollow && !['following', 'requested'].includes(row.relationship)
            ? <Button variant="ghost" className="new-activity-pill primary" disabled={busy === row.key} onClick={async () => {
                if (busy) return;
                setBusy(row.key);
                try {
                  await follow({ data: { target: row.actorId } });
                  await Promise.all(['new-activity', 'new-activity-unread', 'social-list', 'social-list-pages', 'new-own-profile'].map(key => qc.invalidateQueries({ queryKey: [key] })));
                } catch (e) { toast.error(e instanceof Error ? e.message : 'Please try again.'); }
                finally { setBusy(null); }
              }}>Follow back</Button>
            : row.kind === 'reminder' && row.canCheckIn && row.groupId
              ? <Button variant="ghost" className="new-activity-pill soft" onClick={() => void open(row)}>Check in</Button>
              : row.postId && (row.media || row.mediaKind === 'video')
                ? <ActivityThumbnail row={row} onOpen={() => void open(row)} />
                : null}
      </div>)}</section>;
    })}
  </div>;
}
