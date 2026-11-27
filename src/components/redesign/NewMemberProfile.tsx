import { useState } from 'react';
import { Navigate, useNavigate, useRouter } from '@tanstack/react-router';
import { queryOptions, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Ban, ChevronDown, Flag, Lock, UserMinus, UserX } from 'lucide-react';
import { newToastApi as toast } from "./new-toast";
import { Button } from '@/components/ui/button';
import { getRedesignMemberProfile } from '@/lib/redesign-profile.functions';
import { followUser, removeFollower, unfollowUser } from '@/lib/follows.functions';
import { sendContentReport, setUserBlock } from '@/lib/safety.functions';
import { reportReasons, type SafetyReport } from '@/lib/safety-rules';
import { blockConfirmBody, followedByLine, memberFirstName } from '@/lib/redesign-profile';
import { memberInfoParts, profileState, type ProfileState } from '@/lib/profile-state';
import { stabilizeSignedUrls } from '@/lib/stable-urls';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { useStatusBarScrollToTop } from '@/lib/status-bar-scroll';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { getHomeCrew } from '@/lib/home-crew.functions';
import { nudgeMember } from '@/lib/group-today.functions';
import { NewSheet, NewSheetButton, NewSheetCheckbox, NewSheetChevron, NewSheetMenuIcon, NewSheetRow } from './NewSheet';
import { NewConfirm } from './NewConfirm';
import { getMemberSocialPosts } from '@/lib/posts.functions';
import { profileGridTiles } from '@/lib/saved-posts';
import { LockCard, MealsTab, MemberWorkoutsTab, P51Avatar, P51Back, P51Header, P51More, P51PostsGrid, P51Stats, P51Tabs, PlansTab, ProfileSkeleton, shareLink, type ProfileTab } from './NewProfileParts';

export const memberProfileOptions = (target: string) => queryOptions({
  queryKey: ['new-member-profile', target],
  queryFn: () => getRedesignMemberProfile({ data: { target } }).then(stabilizeSignedUrls),
  staleTime: 30_000,
});

type Sheet = null | 'menu' | 'requested' | 'following' | 'report';

function MemberPosts({ target, name }: { target: string; name: string }) {
  const { data } = useQuery({ queryKey: ['member-social-posts', target], queryFn: () => getMemberSocialPosts({ data: { target } }), staleTime: 30_000 });
  return <P51PostsGrid tiles={data ? profileGridTiles(data, `${name}'s post`) : undefined} emptyBody={`When ${name} posts a workout, meal or photo, it shows up here.`} />;
}

function Shell({ title, state, onBack, onMore, moreLabel, children }: { title: string; state: ProfileState; onBack: () => void; onMore?: () => void; moreLabel?: string; children: React.ReactNode }) {
  return <div data-scroll-root className="redesign-step3 new-profile-page fixed inset-0 overflow-y-auto overscroll-none pb-[calc(104px+env(safe-area-inset-bottom))]">
    <P51Header title={title} left={<P51Back onClick={onBack} />} right={state.header.right === 'more' && onMore ? <P51More label={moreLabel ?? 'Options'} onClick={onMore} /> : null} />
    {children}
  </div>;
}

export function NewMemberProfile({ target, tab, onTab }: { target: string; tab: ProfileTab; onTab: (t: ProfileTab) => void }) {
  const query = useQuery(memberProfileOptions(target));
  const router = useRouter();
  const navigate = useNavigate();
  const back = () => { if (router.history.canGoBack()) router.history.back(); else void navigate({ to: '/home' }); };
  if (query.isPending) return <Shell title="" state={profileState({ status: 'loading' })} onBack={back}><ProfileSkeleton /></Shell>;
  if (query.isError) return <Shell title="" state={profileState({ status: 'error' })} onBack={back}>
    <section className="p51-error" role="alert"><div><h2>Couldn't load this profile</h2><p>Check your connection and try again.</p></div><Button variant="ghost" className="p51-btn outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Try again</Button></section>
  </Shell>;
  const profile = query.data;
  if (!profile) return <Shell title="" state={profileState({ status: 'unavailable' })} onBack={back}>
    <section className="p51-card"><span className="lock"><Ban size={24} /></span><h2>This account isn't available</h2><p>It may have been deleted, or the link is wrong.</p></section>
  </Shell>;
  if (profile.isSelf) return <Navigate to="/profile" replace />;
  if (profile.blocked) return <BlockedProfile profile={profile} onBack={back} />;
  return <MemberProfileBody profile={profile} tab={tab} onTab={onTab} onBack={back} />;
}

type Loaded = Extract<NonNullable<Awaited<ReturnType<typeof getRedesignMemberProfile>>>, { isSelf: false; blocked: false }>;
type Blocked = Extract<NonNullable<Awaited<ReturnType<typeof getRedesignMemberProfile>>>, { blocked: true }>;

function BlockedProfile({ profile, onBack }: { profile: Blocked; onBack: () => void }) {
  const qc = useQueryClient();
  const block = useServerFn(setUserBlock);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useHideBottomTabs(open);
  const first = memberFirstName(profile.name ?? '', profile.username);
  const state = profileState({ status: 'other', iBlocked: true, isPrivate: false, under18: false, follow: 'none', followsMe: false, canFollow: false, sharedCrews: 0, nudgeable: false });
  const unblock = async () => {
    if (busy) return;
    setBusy(true);
    try { await block({ data: { userId: profile.id, blocked: false } }); await qc.invalidateQueries(); setOpen(false); toast.success(`${first} unblocked`); }
    catch { toast.error('Could not unblock. Try again.'); }
    finally { setBusy(false); }
  };
  return <Shell title={`@${profile.username || first}`} state={{ ...state, header: { left: 'back', right: 'none' } }} onBack={onBack}>
    <section className="new-profile-identity">
      <div className="new-profile-avatar-row"><P51Avatar url={null} label={first} /><div className="min-w-0"><h2 className="new-profile-name">{profile.name?.trim() || profile.username}</h2></div></div>
      <div className="p51-buttons"><Button variant="ghost" className="p51-btn outline" onClick={() => setOpen(true)}>Unblock</Button></div>
    </section>
    <section className="p51-card"><span className="lock"><Ban size={24} /></span><h2>You blocked {first}</h2><p>They can't see your profile, posts or check-ins, and you won't see theirs. They aren't told you blocked them.</p></section>
    <NewSheet open={open} onOpenChange={setOpen} title={`Unblock ${first}?`} subtitle={`${first} will be able to see your profile and follow you again. They aren't told.`}>
      <NewSheetButton disabled={busy} onClick={() => void unblock()}>Unblock</NewSheetButton>
    </NewSheet>
  </Shell>;
}

function MemberProfileBody({ profile, tab, onTab, onBack: back }: { profile: Loaded; tab: ProfileTab; onTab: (t: ProfileTab) => void; onBack: () => void }) {
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
  const [nudged, setNudged] = useState(false);
  useHideBottomTabs(sheet !== null || blockOpen);
  const follow = useServerFn(followUser);
  const unfollow = useServerFn(unfollowUser);
  const remove = useServerFn(removeFollower);
  const report = useServerFn(sendContentReport);
  const block = useServerFn(setUserBlock);
  const nudge = useServerFn(nudgeMember);
  const crews = useQueries({ queries: profile.sharedCrews.map(c => ({ queryKey: ['home-crew', c.id], queryFn: () => getHomeCrew({ data: { groupId: c.id } }), staleTime: 30_000 })) });
  // Nudge: they haven't checked in today in a shared crew where they're expected today (not resting).
  const nudgeCrew = profile.sharedCrews.find((c, i) => {
    const m = crews[i]?.data?.members.find(x => x.userId === profile.id);
    return m && !m.isYou && m.status === 'not_yet' && m.nudgeAllowed !== false;
  }) ?? null;
  const nudgedAlready = profile.sharedCrews.some((c, i) => c.id === nudgeCrew?.id && crews[i]?.data?.members.find(x => x.userId === profile.id)?.nudgedToday);

  const first = memberFirstName(profile.name, profile.username);
  const followState = profile.relationship === 'following' ? 'following' : profile.relationship === 'requested' ? 'requested' : 'none';
  const state = profileState({ status: 'other', iBlocked: false, isPrivate: profile.isPrivate, under18: false, follow: followState, followsMe: profile.followsMe || profile.relationship === 'follows_you', canFollow: profile.canFollow, sharedCrews: profile.sharedCrews.length, nudgeable: !!nudgeCrew || nudged });
  const crew = profile.sharedCrews[0] ?? null;
  const followed = followedByLine(profile.followedBy?.firstName ?? null, profile.followedBy?.total ?? 0);
  const info = memberInfoParts({ crewNames: profile.sharedCrews.map(c => c.name), streak: profile.streak ?? null, followsYou: state.followsYou, followedBy: followed });
  const following = profile.relationship === 'following';
  const canSeeLists = !profile.isPrivate || following;
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['new-member-profile'] }), qc.invalidateQueries({ queryKey: ['new-own-profile'] }), qc.invalidateQueries({ queryKey: ['profile-workouts'] }), qc.invalidateQueries({ queryKey: ['profile-plans'] }), qc.invalidateQueries({ queryKey: ['member-social-posts'] })]);
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
      setBlockOpen(false); toast.success(`${first} blocked`);
    } catch { setBlockError('Could not block. Try again.'); }
    finally { setBusy(false); }
  };
  const sendNudge = async () => {
    if (!nudgeCrew || busy || nudged) return;
    setBusy(true);
    try { const r = await nudge({ data: { groupId: nudgeCrew.id, userId: profile.id } }); setNudged(true); toast.success(r.message); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not nudge. Try again.'); }
    finally { setBusy(false); }
  };
  const red = (text: string) => <span className="text-[var(--new-confirm-destructive)]">{text}</span>;
  const doFollow = () => run(() => follow({ data: { target: profile.id } }));
  const sent = nudged || nudgedAlready;

  return <div ref={scroll} data-scroll-root className="redesign-step3 new-profile-page fixed inset-0 overflow-y-auto overscroll-none pb-[calc(104px+env(safe-area-inset-bottom))]">
    <P51Header title={<span className="inline-flex max-w-full items-center gap-1">{profile.isPrivate && <Lock size={14} aria-label="Private account" className="shrink-0" />}<span className="truncate">@{profile.username || first}</span></span>} left={<P51Back onClick={back} />} right={<P51More label={`Options for ${first}`} onClick={() => setSheet('menu')} />} />
    <section className="new-profile-identity">
      <div className="new-profile-avatar-row"><P51Avatar url={profile.avatarUrl} label={first} /><P51Stats userId={profile.id} posts={profile.posts} followers={profile.followers} following={profile.following} listsOpen={canSeeLists} /></div>
      <div>
        <h2 className="new-profile-name">{profile.name.trim() || profile.username}</h2>
        {profile.bio && <p className="new-profile-bio">{profile.bio}</p>}
        {info.length > 0 && <p className="p51-line">{info.join(' · ')}</p>}
      </div>
      <div className="p51-buttons">{state.buttons.map(b => b === 'follow' ? <Button key={b} variant="ghost" disabled={busy} className="p51-btn primary" onClick={() => void doFollow()}>Follow</Button>
        : b === 'follow_back' ? <Button key={b} variant="ghost" disabled={busy} className="p51-btn primary" onClick={() => void doFollow()}>Follow back</Button>
        : b === 'following' ? <Button key={b} variant="ghost" disabled={busy} className="p51-btn light" onClick={() => setSheet('following')}>Following<ChevronDown size={16} /></Button>
        : b === 'requested' ? <Button key={b} variant="ghost" disabled={busy} className="p51-btn light" onClick={() => setSheet('requested')}>Requested</Button>
        : b === 'nudge' ? <Button key={b} variant="ghost" disabled={busy || sent} className="p51-btn light" onClick={() => void sendNudge()}>{sent ? 'Nudged' : '🔔 Nudge'}</Button>
        : <Button key={b} variant="ghost" className="p51-btn light" onClick={() => void shareLink(`/u/${profile.username || profile.id}`, profile.name)}>Share profile</Button>)}</div>
    </section>
    {state.content === 'locked' ? <><P51Tabs tab={tab} muted /><LockCard first={first} crew={state.crewLink ? crew : null} /></> : <>
      <P51Tabs tab={tab} onTab={onTab} />
      {tab === 'posts' && <MemberPosts target={profile.id} name={first} />}
      {tab === 'workouts' && <MemberWorkoutsTab target={profile.id} />}
      {tab === 'plans' && <PlansTab target={profile.id} />}
      {tab === 'meals' && <MealsTab own={false} />}
    </>}

    <NewSheet open={sheet === 'menu'} onOpenChange={open => setSheet(open ? 'menu' : null)} title={`Options for ${first}`} hideTitle>
      <NewSheetRow title={`Report ${first}`} subtitle="Tell us what's going on. We review every report." leading={<NewSheetMenuIcon><Flag /></NewSheetMenuIcon>} trailing={<NewSheetChevron />} onClick={openReport} />
      {following && <NewSheetRow title="Unfollow" disabled={busy} leading={<NewSheetMenuIcon><UserMinus /></NewSheetMenuIcon>} onClick={() => run(() => unfollow({ data: { target: profile.id } }))} />}
      {profile.followsMe && <NewSheetRow title="Remove follower" subtitle={`${first} won't be told.`} disabled={busy} leading={<NewSheetMenuIcon><UserX /></NewSheetMenuIcon>} onClick={() => run(() => remove({ data: { follower: profile.id } }))} />}
      <NewSheetRow destructive title={`Block ${first}`} leading={<NewSheetMenuIcon><Ban className="text-[var(--new-destructive)]" /></NewSheetMenuIcon>} onClick={() => { setSheet(null); setBlockError(null); setTimeout(() => setBlockOpen(true), 350); }} />
    </NewSheet>
    <NewSheet open={sheet === 'requested'} onOpenChange={open => setSheet(open ? 'requested' : null)} title="Cancel follow request?">
      <NewSheetRow simple title={red('Cancel request')} disabled={busy} onClick={() => run(() => unfollow({ data: { target: profile.id } }))} />
    </NewSheet>
    <NewSheet open={sheet === 'following'} onOpenChange={open => setSheet(open ? 'following' : null)} title={`Following ${first}`} hideTitle={!profile.isPrivate} {...(profile.isPrivate ? { subtitle: "You'll need to ask again to see their profile." } : {})}>
      <NewSheetRow simple title={red('Unfollow')} disabled={busy} onClick={() => run(() => unfollow({ data: { target: profile.id } }))} />
    </NewSheet>
    <NewSheet open={sheet === 'report'} onOpenChange={open => { if (!busy) setSheet(open ? 'report' : null); }} title={`Report ${first}`} subtitle={`What's going on? ${first} won't know who reported them.`}>
      <div role="radiogroup" aria-label="Reason">
        {reportReasons.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={reason === value} className="new-report-radio" onClick={() => setReason(value)}><span>{label}</span><span className={`new-report-dot${reason === value ? ' on' : ''}`} aria-hidden /></button>)}
      </div>
      <textarea className="new-report-details" value={details} maxLength={500} placeholder="Add details (optional)" aria-label="Add details (optional)" onChange={e => setDetails(e.target.value)} />
      <button type="button" role="checkbox" aria-checked={alsoBlock} className="new-report-block" onClick={() => setAlsoBlock(v => !v)}><NewSheetCheckbox checked={alsoBlock} /><span>Also block {first}</span></button>
      <NewSheetButton disabled={!reason || busy} onClick={() => void sendReport()}>Send report</NewSheetButton>
    </NewSheet>
    <NewConfirm open={blockOpen} onOpenChange={setBlockOpen} top={<span className="new-profile-avatar" style={{ width: 56, height: 56 }} aria-hidden>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : null}</span>} title={`Block ${first}?`} subtitle={blockConfirmBody(first, profile.sharedCrews.length === 1 ? profile.sharedCrews[0]!.name : profile.sharedCrews.length > 1 ? 'your crews' : null)} note="You can unblock them in Blocked people." action="Block" busy={busy} error={blockError} onConfirm={() => void confirmBlock()} />
  </div>;
}

