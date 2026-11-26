import { useState } from 'react';
import { Navigate, useNavigate, useRouter } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Ban, ChevronDown, ChevronLeft, Flag, Lock, MessageCircle, MoreHorizontal, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getRedesignMemberProfile } from '@/lib/redesign-profile.functions';
import { followUser, removeFollower, unfollowUser } from '@/lib/follows.functions';
import { sendContentReport, setUserBlock } from '@/lib/safety.functions';
import { reportReasons, type SafetyReport } from '@/lib/safety-rules';
import { blockConfirmBody, followedByLine, memberFirstName, memberFollowButton, memberProfileBody } from '@/lib/redesign-profile';
import { stabilizeSignedUrls } from '@/lib/stable-urls';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { useStatusBarScrollToTop } from '@/lib/status-bar-scroll';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { NewSheet, NewSheetButton, NewSheetCheckbox, NewSheetChevron, NewSheetRow } from './NewSheet';
import { NewConfirm } from './NewConfirm';
import { NewProfileWeekCard } from './NewOwnProfile';

export const memberProfileOptions = (target: string) => queryOptions({
  queryKey: ['new-member-profile', target],
  queryFn: () => getRedesignMemberProfile({ data: { target } }).then(stabilizeSignedUrls),
  staleTime: 30_000,
});

type Sheet = null | 'menu' | 'requested' | 'following' | 'report' | 'message' | 'crew';

function MemberAvatar({ url, size }: { url: string | null; size: 56 | 84 }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className="new-profile-avatar" style={{ width: size, height: size }} aria-hidden>
    {url && url !== failed ? <img src={url} alt="" onError={() => setFailed(url)} /> : <UserRound size={Math.round(size * .54)} strokeWidth={2.2} />}
  </span>;
}

export function NewMemberProfile({ target }: { target: string }) {
  const { data: profile } = useSuspenseQuery(memberProfileOptions(target));
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scroll = useOpenAtTop();
  useStatusBarScrollToTop();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [reason, setReason] = useState<SafetyReport['reason'] | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [chosenCrew, setChosenCrew] = useState<string | null>(null);
  useHideBottomTabs(sheet !== null || blockOpen);
  const follow = useServerFn(followUser);
  const unfollow = useServerFn(unfollowUser);
  const remove = useServerFn(removeFollower);
  const report = useServerFn(sendContentReport);
  const block = useServerFn(setUserBlock);
  const back = () => { if (router.history.canGoBack()) router.history.back(); else void navigate({ to: '/home' }); };

  if (!profile) return <Unavailable title="Profile" onBack={back} />;
  if (profile.isSelf) return <Navigate to="/profile" replace />;
  if (profile.blocked) return <Unavailable title={profile.username || memberFirstName(profile.name, null)} onBack={back} />;

  const first = memberFirstName(profile.name, profile.username);
  const button = memberFollowButton(profile.relationship, profile.followsMe, profile.canFollow);
  const body = memberProfileBody({ relationship: profile.relationship, isPrivate: profile.isPrivate, sharedCrews: profile.sharedCrews.length });
  const crew = profile.sharedCrews.find(c => c.id === chosenCrew) ?? profile.sharedCrews[0] ?? null;
  const followed = followedByLine(profile.followedBy?.firstName ?? null, profile.followedBy?.total ?? 0);
  const streak = profile.streak ?? null;
  const following = profile.relationship === 'following';
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['new-member-profile'] }), qc.invalidateQueries({ queryKey: ['new-own-profile'] })]);
  const run = async (action: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy(true);
    try { await action(); await refresh(); setSheet(null); if (done) toast.success(done); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Something went wrong. Try again.'); }
    finally { setBusy(false); }
  };
  const openReport = () => { setReason(null); setDetails(''); setAlsoBlock(false); setSheet('report'); };
  const sendReport = () => reason && run(async () => {
    await report({ data: { reportedUserId: profile.id, targetType: 'user', targetId: null, groupId: profile.sharedCrews[0]?.id ?? null, reason, details: details.trim(), alsoBlock } });
    if (alsoBlock) back();
  }, "Thanks. We'll review it.");
  const confirmBlock = async () => {
    if (busy) return;
    setBusy(true); setBlockError(null);
    try {
      await block({ data: { userId: profile.id, blocked: true } });
      await qc.invalidateQueries();
      setBlockOpen(false); back(); toast.success(`${first} blocked`);
    } catch { setBlockError('Could not block. Try again.'); }
    finally { setBusy(false); }
  };
  const message = () => {
    if (profile.sharedCrews.length > 1) { setSheet('message'); return; }
    const only = profile.sharedCrews[0];
    if (only) void navigate({ to: '/chat/$groupId', params: { groupId: only.id } });
  };
  const red = (text: string) => <span className="text-[var(--new-confirm-destructive)]">{text}</span>;

  return <div ref={scroll} data-scroll-root className="redesign-step3 new-profile-page fixed inset-0 overflow-y-auto overscroll-none pb-[calc(104px+env(safe-area-inset-bottom))]">
    <header className="new-profile-header pt-new-top"><div className="new-profile-header-row">
      <Button variant="ghost" className="new-profile-menu-button" aria-label="Back" onClick={back}><ChevronLeft size={24} /></Button>
      <h1 className="new-member-title">{profile.isPrivate && <Lock size={14} aria-label="Private account" />}<span>{profile.username || first}</span></h1>
      <Button variant="ghost" className="new-profile-menu-button" aria-label={`Options for ${first}`} onClick={() => setSheet('menu')}><MoreHorizontal size={22} /></Button>
    </div></header>
    <section className="new-profile-identity">
      <div className="new-profile-avatar-row"><MemberAvatar url={profile.avatarUrl} size={84} /><div className="new-profile-counts"><div><strong>{profile.followers}</strong><span>followers</span></div><div><strong>{profile.following}</strong><span>following</span></div></div></div>
      <div>
        <h2 className="new-profile-name">{profile.name.trim() || profile.username}</h2>
        {profile.bio && <p className="new-profile-bio">{profile.bio}</p>}
        {((streak ?? 0) > 0 || followed) && <p className="new-member-meta">{[(streak ?? 0) > 0 ? `${streak}-day streak` : null, followed].filter(Boolean).join(' · ')}</p>}
      </div>
      {(button || profile.sharedCrews.length > 0) && <div className="new-member-actions">
        {button === 'follow' && <Button variant="ghost" disabled={busy} className="new-member-btn primary" onClick={() => run(() => follow({ data: { target: profile.id } }))}>Follow</Button>}
        {button === 'follow_back' && <Button variant="ghost" disabled={busy} className="new-member-btn primary" onClick={() => run(() => follow({ data: { target: profile.id } }))}>Follow back</Button>}
        {button === 'requested' && <Button variant="ghost" disabled={busy} className="new-member-btn quiet" onClick={() => setSheet('requested')}>Requested</Button>}
        {button === 'following' && <Button variant="ghost" disabled={busy} className="new-member-btn quiet" onClick={() => setSheet('following')}>Following<ChevronDown size={16} /></Button>}
        {profile.sharedCrews.length > 0 && <Button variant="ghost" className="new-member-btn soft" onClick={message}><MessageCircle size={17} />Message</Button>}
      </div>}
    </section>
    {body === 'week' && crew && <NewProfileWeekCard groupId={crew.id} crewName={crew.name} showPicker={profile.sharedCrews.length > 1} onPick={() => setSheet('crew')} freezes={null} memberId={profile.id} />}
    {body === 'private' && <div className="new-member-private"><span className="new-member-lock"><Lock size={28} /></span><h2>This account is private</h2><p>Follow {first} to see their progress.</p></div>}

    <NewSheet open={sheet === 'menu'} onOpenChange={open => setSheet(open ? 'menu' : null)} title={`Options for ${first}`} hideTitle>
      <NewSheetRow title={`Report ${first}`} subtitle="Tell us what's going on. We review every report." leading={<Flag />} trailing={<NewSheetChevron />} onClick={openReport} />
      {following && <NewSheetRow title="Unfollow" disabled={busy} onClick={() => run(() => unfollow({ data: { target: profile.id } }))} />}
      {profile.followsMe && <NewSheetRow title="Remove follower" subtitle={`${first} won't be told.`} disabled={busy} onClick={() => run(() => remove({ data: { follower: profile.id } }))} />}
      <NewSheetRow destructive title={`Block ${first}`} leading={<Ban className="text-[var(--new-destructive)]" />} onClick={() => { setSheet(null); setBlockError(null); setTimeout(() => setBlockOpen(true), 350); }} />
    </NewSheet>
    <NewSheet open={sheet === 'requested'} onOpenChange={open => setSheet(open ? 'requested' : null)} title="Cancel follow request?">
      <NewSheetRow simple title={red('Cancel request')} disabled={busy} onClick={() => run(() => unfollow({ data: { target: profile.id } }))} />
    </NewSheet>
    <NewSheet open={sheet === 'following'} onOpenChange={open => setSheet(open ? 'following' : null)} title={`Following ${first}`} hideTitle={!profile.isPrivate} {...(profile.isPrivate ? { subtitle: "You'll need to ask again to see their profile." } : {})}>
      <NewSheetRow simple title={red('Unfollow')} disabled={busy} onClick={() => run(() => unfollow({ data: { target: profile.id } }))} />
    </NewSheet>
    <NewSheet open={sheet === 'message'} onOpenChange={open => setSheet(open ? 'message' : null)} title="Pick a crew chat">
      {profile.sharedCrews.map(c => <NewSheetRow key={c.id} simple title={c.name} trailing={<NewSheetChevron />} onClick={() => { setSheet(null); void navigate({ to: '/chat/$groupId', params: { groupId: c.id } }); }} />)}
    </NewSheet>
    <NewSheet open={sheet === 'crew'} onOpenChange={open => setSheet(open ? 'crew' : null)} title="Pick your crew">
      {profile.sharedCrews.map(c => <NewSheetRow key={c.id} simple title={c.name} trailing={<NewSheetCheckbox checked={c.id === crew?.id} />} onClick={() => { setChosenCrew(c.id); setSheet(null); }} />)}
    </NewSheet>
    <NewSheet open={sheet === 'report'} onOpenChange={open => { if (!busy) setSheet(open ? 'report' : null); }} title={`Report ${first}`} subtitle={`What's going on? ${first} won't know who reported them.`}>
      <div role="radiogroup" aria-label="Reason">
        {reportReasons.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={reason === value} className="new-report-radio" onClick={() => setReason(value)}><span>{label}</span><span className={`new-report-dot${reason === value ? ' on' : ''}`} aria-hidden /></button>)}
      </div>
      <textarea className="new-report-details" value={details} maxLength={500} placeholder="Add details (optional)" aria-label="Add details (optional)" onChange={e => setDetails(e.target.value)} />
      <button type="button" role="checkbox" aria-checked={alsoBlock} className="new-report-block" onClick={() => setAlsoBlock(v => !v)}><NewSheetCheckbox checked={alsoBlock} /><span>Also block {first}</span></button>
      <NewSheetButton disabled={!reason || busy} onClick={() => void sendReport()}>Send report</NewSheetButton>
    </NewSheet>
    <NewConfirm open={blockOpen} onOpenChange={setBlockOpen} top={<MemberAvatar url={profile.avatarUrl} size={56} />} title={`Block ${first}?`} subtitle={blockConfirmBody(first, profile.sharedCrews.length === 1 ? profile.sharedCrews[0]!.name : profile.sharedCrews.length > 1 ? 'your crews' : null)} note="You can unblock them in Blocked people." action="Block" busy={busy} error={blockError} onConfirm={() => void confirmBlock()} />
  </div>;
}

function Unavailable({ title, onBack }: { title: string; onBack: () => void }) {
  return <div className="redesign-step3 new-profile-page fixed inset-0 overflow-y-auto">
    <header className="new-profile-header pt-new-top"><div className="new-profile-header-row">
      <Button variant="ghost" className="new-profile-menu-button" aria-label="Back" onClick={onBack}><ChevronLeft size={24} /></Button>
      <h1>{title}</h1><span className="new-profile-header-spacer" />
    </div></header>
    <div className="new-member-private"><span className="new-member-lock"><Ban size={28} /></span><h2>This profile isn't available</h2></div>
  </div>;
}
