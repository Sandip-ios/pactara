import { useEffect, useRef, useState } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useRouteContext } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ChevronRight, Flame, Image as ImageIcon, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { markNotificationsRead } from '@/lib/notifications.functions';
import { followUser } from '@/lib/follows.functions';
import { activityReadBatches, activitySection, activityTime, requestSummary } from '@/lib/profile-social';
import { feedUrl } from '@/lib/feed-deeplink';
import { syncAppBadge } from '@/lib/badge-client';
import { beginNewCheckIn } from '@/lib/redesign-checkin';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { useStatusBarScrollToTop } from '@/lib/status-bar-scroll';
import { activityOptions } from './social-query';
import { SocialAvatar, SocialHeader } from './NewSocialBits';
import { CrewAvatarOverlap } from './CrewAvatars';

type ActivityRow = { key: string; kind: string; actorId: string; name: string; avatar: string | null; text: string; createdAt: string; read: boolean; groupId: string | null; groupName: string; postId: string | null; media: string | null; mediaKind: string | null; canFollow: boolean; canCheckIn: boolean; relationship: string };

function ActivityCopy({ row }: { row: ActivityRow }) {
  const hideActor = row.kind === 'reminder' || row.kind === 'pact_complete';
  const text = row.kind.startsWith('follow') ? row.text.replace(/^\S+\s+/, '') : row.text;
  const index = row.groupName ? text.indexOf(row.groupName) : -1;
  return <span>{!hideActor && <><strong>{row.name}</strong>{' '}</>}{index >= 0 ? <>{text.slice(0, index)}<strong>{row.groupName}</strong>{text.slice(index + row.groupName.length)}</> : text}</span>;
}

function ActivityThumbnail({ row, onOpen }: { row: ActivityRow; onOpen: () => void }) {
  const [failed, setFailed] = useState<string | null>(null);
  const hasImage = row.media && row.media !== failed && row.mediaKind !== 'video';
  return <Button variant="ghost" className="new-activity-thumbnail" aria-label={`Open ${row.name}'s post`} onClick={onOpen}>{hasImage ? <img src={row.media ?? ''} alt="" onError={() => setFailed(row.media)} /> : row.mediaKind === 'video' || row.media?.includes('.poster.jpg') ? <Play size={18} aria-hidden /> : <ImageIcon size={18} aria-hidden />}</Button>;
}

export function NewActivity() {
  const { data } = useSuspenseQuery(activityOptions); const qc = useQueryClient(); const navigate = useNavigate();
  const mark = useServerFn(markNotificationsRead); const follow = useServerFn(followUser); const [busy, setBusy] = useState<string | null>(null);
  const scroll = useOpenAtTop(); useStatusBarScrollToTop(); const submitted = useRef(new Set<string>());
  const { user } = useRouteContext({ from: '/_authenticated' });
  const allRows: ActivityRow[] = [
    ...data.crew.map(i => ({ key: i.key, kind: i.kind, actorId: i.actorId, name: i.actorName, avatar: i.actorAvatarUrl, text: i.text, createdAt: i.createdAt, read: i.read, groupId: i.groupId, groupName: i.groupName, postId: i.postId, media: i.mediaUrl, mediaKind: i.mediaKind, canFollow: false, canCheckIn: false, relationship: 'none' })),
    ...data.follows.map(i => ({ ...i, name: i.actorName, groupId: null, groupName: '', postId: null, media: null, mediaKind: null, canCheckIn: false })),
    ...data.items.map(i => ({ ...i, name: i.actorName, postId: null, media: null, mediaKind: null, canFollow: false, relationship: 'none' })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  // Own actions and pending follow requests never show as rows; they are still marked read.
  const rows = allRows.filter(r => (r.actorId !== user.id || r.kind === 'reminder' || r.kind === 'pact_complete') && r.kind !== 'follow_request');
  const unread = allRows.filter(i => !i.read).map(i => i.key).join('|');
  useEffect(() => {
    const keys = unread.split('|').filter(key => key && !submitted.current.has(key)); if (!keys.length) return;
    keys.forEach(key => submitted.current.add(key));
    void Promise.all(activityReadBatches(keys).map(batch => mark({ data: { keys: batch } }))).then(async () => {
      await Promise.all(['new-activity', 'new-activity-unread', 'unread-notification-count', 'notifications'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      await syncAppBadge();
    }).catch(() => { keys.forEach(key => submitted.current.delete(key)); toast.error('Could not mark Activity read. Try opening it again.'); });
  }, [unread, mark, qc]);
  const open = (row: ActivityRow) => {
    if (row.kind === 'follow_request') { void navigate({ to: '/follow-requests' }); return; }
    if (row.kind.startsWith('follow')) { void navigate({ to: '/u/$userId', params: { userId: row.actorId } }); return; }
    if (!row.groupId) return;
    if (row.kind === 'crew_request') { void navigate({ to: '/crews/$groupId/requests', params: { groupId: row.groupId } }); return; }
    if (row.kind === 'message') { void navigate({ to: '/chat/$groupId', params: { groupId: row.groupId } }); return; }
    if (row.postId) { void navigate({ href: feedUrl({ groupId: row.groupId, postId: row.postId, comments: ['comment', 'reply', 'comment_like'].includes(row.kind) }) }); return; }
    void navigate({ to: '/crews/$groupId', params: { groupId: row.groupId } });
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
      const items = rows.filter(i => activitySection(i.createdAt) === section); if (!items.length) return null;
      return <section key={section}><h2 className="new-activity-section">{section}</h2>{items.map(row => <div className="new-activity-row" key={row.key}>
        <Button variant="ghost" className="new-activity-content" onClick={() => open(row)}>
          {row.kind === 'reminder' ? <span className="new-activity-icon"><Flame size={20} /></span> : <SocialAvatar url={row.avatar} size={40} />}
          <span className="new-activity-copy"><ActivityCopy row={row} /><small>{activityTime(row.createdAt)}</small></span>
        </Button>
        {row.kind === 'crew_request' ? <Button variant="ghost" className="new-activity-pill primary" onClick={() => open(row)}>Review</Button> : row.kind === 'follow' && row.canFollow && !['following', 'requested'].includes(row.relationship) ? <Button variant="ghost" className="new-activity-pill primary" disabled={busy === row.key} onClick={async () => { if (busy) return; setBusy(row.key); try { await follow({ data: { target: row.actorId } }); await Promise.all(['new-activity', 'new-activity-unread', 'social-list', 'social-list-pages', 'new-own-profile'].map(key => qc.invalidateQueries({ queryKey: [key] }))); } catch (e) { toast.error(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(null); } }}>Follow back</Button> : row.kind === 'reminder' && row.canCheckIn && row.groupId ? <Button variant="ghost" className="new-activity-pill soft" onClick={() => { if (!row.groupId) return; beginNewCheckIn(row.groupId, null); void navigate({ to: '/check-in' }); }}>Check in</Button> : row.postId && (row.media || row.mediaKind === 'video') ? <ActivityThumbnail row={row} onOpen={() => open(row)} /> : null}
      </div>)}</section>;
    })}
  </div>;
}