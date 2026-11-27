import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Check, ChevronLeft, Dumbbell, Lock, MoreHorizontal, Pencil, Plus, Share, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProfilePlans, getProfileWorkouts } from '@/lib/profile-content.functions';
import { deleteSavedWorkout } from '@/lib/lifts.functions';
import { saveSharedWorkout } from '@/lib/workout-share.functions';
import { groupByMuscle, peopleStarted, workoutMeta, type ProfileWorkoutRow } from '@/lib/profile-state';
import type { SavedTile } from '@/lib/saved-posts';
import { PostGridTile } from './NewSaved';
import { NewSheet, NewSheetMenuIcon, NewSheetRow } from './NewSheet';
import { NewConfirm } from './NewConfirm';
import { NewAvatarFallback } from './NewAvatarFallback';
import { newToastApi as toast } from './new-toast';

export type ProfileTab = 'posts' | 'workouts' | 'plans' | 'meals';
export const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'posts', label: 'Posts' }, { key: 'workouts', label: 'Workouts' }, { key: 'plans', label: 'Plans' }, { key: 'meals', label: 'Meals' },
];
export function parseProfileTab(v: unknown): ProfileTab | null {
  return v === 'workouts' || v === 'plans' || v === 'meals' || v === 'posts' ? v : null;
}

export function P51Header({ title, left, right }: { title: ReactNode; left: ReactNode; right: ReactNode }) {
  return <header className="p51-header"><div className="p51-header-row">
    <div>{left}</div><h1>{title}</h1><div>{right}</div>
  </div></header>;
}
export function P51Back({ onClick }: { onClick: () => void }) {
  return <Button variant="ghost" className="p51-round" aria-label="Back" onClick={onClick}><ChevronLeft size={24} /></Button>;
}
export function P51More({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button variant="ghost" className="p51-round" aria-label={label} onClick={onClick}><MoreHorizontal size={22} /></Button>;
}

export function P51Avatar({ url, label }: { url: string | null; label: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className="new-profile-avatar avatar-84" aria-label={label}>{url && url !== failed ? <img src={url} alt="" onError={() => setFailed(url)} /> : <NewAvatarFallback />}</span>;
}

/** posts / followers / following; the two lists open only when `listsOpen`. */
export function P51Stats({ userId, posts, followers, following, listsOpen }: { userId: string; posts: number; followers: number; following: number; listsOpen: boolean }) {
  return <div className="p51-counts">
    <div className="p51-stat"><strong>{posts}</strong><span>posts</span></div>
    {(['followers', 'following'] as const).map(tab => listsOpen
      ? <Button key={tab} variant="ghost" asChild className="p51-stat"><Link to="/u/$userId/follows" params={{ userId }} search={{ socialTab: tab }}><strong>{tab === 'followers' ? followers : following}</strong><span>{tab}</span></Link></Button>
      : <div key={tab} className="p51-stat"><strong>{tab === 'followers' ? followers : following}</strong><span>{tab}</span></div>)}
  </div>;
}

export function P51Tabs({ tab, onTab, muted = false }: { tab: ProfileTab; onTab?: (t: ProfileTab) => void; muted?: boolean }) {
  return <div role="tablist" aria-label="Profile" className={`p51-tabs${muted ? ' is-muted' : ''}`}>
    {PROFILE_TABS.map(t => <button key={t.key} type="button" role="tab" disabled={!onTab} aria-selected={!muted && tab === t.key} className="p51-tab" onClick={() => onTab?.(t.key)}>{t.label}</button>)}
  </div>;
}

export function P51Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <div className="p51-empty"><h3>{title}</h3>{body && <p>{body}</p>}{action}</div>;
}

export function P51PostsGrid({ tiles, emptyBody }: { tiles: SavedTile[] | undefined; emptyBody: string }) {
  if (!tiles) return <div className="h-40" aria-label="Loading posts" />;
  if (!tiles.length) return <P51Empty title="No posts yet" body={emptyBody} />;
  return <section aria-label="Posts" className="grid grid-cols-3 gap-[2px] pt-[2px]">{tiles.map(t => <PostGridTile key={t.id} tile={t} />)}</section>;
}

/** Share a link (native share sheet when there is one, otherwise copy). */
export async function shareLink(path: string, title: string) {
  const url = `${window.location.origin}${path}`;
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    toast.error('Could not share. Try again.');
  }
}

const workoutsKey = (target: string | null) => ['profile-workouts', target ?? 'me'];

export function OwnWorkoutsTab() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: workoutsKey(null), queryFn: () => getProfileWorkouts({ data: { target: null } }), staleTime: 30_000 });
  const remove = useServerFn(deleteSavedWorkout);
  const [menu, setMenu] = useState<ProfileWorkoutRow | null>(null);
  const [confirm, setConfirm] = useState<ProfileWorkoutRow | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return <div className="h-40" aria-label="Loading workouts" />;
  if (!data.length) return <P51Empty title="No workouts yet" body="Build one, or add one from a post or a profile. They show up here for people who visit you." action={<Button variant="ghost" asChild className="p51-btn primary"><Link to="/workouts/new"><Plus size={18} />Build a workout</Link></Button>} />;
  const doRemove = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try { await remove({ data: { workoutId: confirm.id } }); await qc.invalidateQueries({ queryKey: ['profile-workouts'] }); void qc.invalidateQueries({ queryKey: ['my-workouts'] }); setConfirm(null); toast.success('Removed from your workouts'); }
    catch { toast.error('Could not remove. Try again.'); }
    finally { setBusy(false); }
  };
  return <section className="p51-section">
    <div className="p51-section-head"><h2>YOUR WORKOUTS · {data.length}</h2><Link to="/workouts/new" className="p51-new"><Plus size={16} />New</Link></div>
    <div className="p51-list">{data.map(w => <div key={w.id} className="p51-row">
      <span className="p51-tile"><Dumbbell size={20} /></span>
      <Link to="/workouts/$workoutId" params={{ workoutId: w.id }} className="min-w-0"><strong>{w.name}</strong><small>{workoutMeta(w, true)}</small></Link>
      <Button variant="ghost" className="p51-dots" aria-label={`Options for ${w.name}`} onClick={() => setMenu(w)}><MoreHorizontal size={18} /></Button>
    </div>)}</div>
    <NewSheet open={!!menu} onOpenChange={o => { if (!o) setMenu(null); }} title={menu?.name ?? 'Workout'} hideTitle>
      <NewSheetRow simple title="Edit" leading={<NewSheetMenuIcon><Pencil /></NewSheetMenuIcon>} onClick={() => { const id = menu?.id; setMenu(null); if (id) void navigate({ to: '/workouts/$workoutId/edit', params: { workoutId: id } }); }} />
      <NewSheetRow simple destructive title="Remove from my workouts" leading={<NewSheetMenuIcon><Trash2 className="text-[var(--new-destructive)]" /></NewSheetMenuIcon>} onClick={() => { const w = menu; setMenu(null); setTimeout(() => setConfirm(w), 300); }} />
    </NewSheet>
    <NewConfirm open={!!confirm} onOpenChange={o => { if (!o) setConfirm(null); }} title="Remove this workout?" subtitle={`${confirm?.name ?? 'It'} will be removed from your workouts. Your past check-ins stay.`} action="Remove" busy={busy} error={null} onConfirm={() => void doRemove()} />
  </section>;
}

export function MemberWorkoutsTab({ target }: { target: string }) {
  const qc = useQueryClient();
  const key = workoutsKey(target);
  const { data } = useQuery({ queryKey: key, queryFn: () => getProfileWorkouts({ data: { target } }), staleTime: 30_000 });
  const save = useServerFn(saveSharedWorkout);
  const remove = useServerFn(deleteSavedWorkout);
  const [busy, setBusy] = useState<string | null>(null);
  if (!data) return <div className="h-40" aria-label="Loading workouts" />;
  if (!data.length) return <P51Empty title="No workouts yet" />;
  const setCopy = (code: string, myCopyId: string | null) => qc.setQueryData<ProfileWorkoutRow[]>(key, rows => rows?.map(r => r.code === code ? { ...r, myCopyId } : r));
  const add = async (w: ProfileWorkoutRow) => {
    if (!w.code) return;
    const res = await save({ data: { code: w.code } });
    if (res.status === 'saved' && 'workoutId' in res) setCopy(w.code, String(res.workoutId));
    else void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['my-workouts'] });
    return res;
  };
  const toggle = async (w: ProfileWorkoutRow) => {
    if (!w.code || busy) return;
    setBusy(w.code);
    try {
      if (w.myCopyId) {
        await remove({ data: { workoutId: w.myCopyId } });
        setCopy(w.code, null);
        void qc.invalidateQueries({ queryKey: ['my-workouts'] });
        toast('Removed from your workouts', { undo: () => void add(w) });
      } else {
        await add(w);
        toast.success('Added to your workouts');
      }
    } catch { toast.error('Something went wrong. Try again.'); }
    finally { setBusy(null); }
  };
  return <section className="p51-section">{groupByMuscle(data).map(g => <div key={g.muscle} className="p51-group">
    <div className="p51-section-head"><h2>{g.muscle.toUpperCase()} · {g.items.length}</h2></div>
    <div className="p51-list">{g.items.map(w => <div key={w.id} className="p51-row">
      <span className="p51-tile"><Dumbbell size={20} /></span>
      {w.code ? <Link to="/workouts/$workoutId" params={{ workoutId: w.code }} className="min-w-0"><strong>{w.name}</strong><small>{workoutMeta(w, false)}</small></Link> : <div className="min-w-0"><strong>{w.name}</strong><small>{workoutMeta(w, false)}</small></div>}
      {w.code && <Button variant="ghost" disabled={busy === w.code} className={`p51-add${w.myCopyId ? ' is-added' : ''}`} aria-pressed={!!w.myCopyId} aria-label={w.myCopyId ? `Remove ${w.name} from my workouts` : `Add ${w.name} to my workouts`} onClick={() => void toggle(w)}>{w.myCopyId ? <Check size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={2.5} />}</Button>}
    </div>)}</div>
  </div>)}</section>;
}

export function PlansTab({ target }: { target: string | null }) {
  const { data } = useQuery({ queryKey: ['profile-plans', target ?? 'me'], queryFn: () => getProfilePlans({ data: { target } }), staleTime: 30_000 });
  const [menu, setMenu] = useState<{ slug: string; name: string } | null>(null);
  if (!data) return <div className="h-40" aria-label="Loading plans" />;
  if (!data.length) return target
    ? <P51Empty title="No plans yet" />
    : <P51Empty title="No plans yet" body="Start a plan and it shows up here for people who visit you." action={<Button variant="ghost" asChild className="p51-btn primary"><Link to="/groups" search={{ tab: 'plans' }}>Browse plans</Link></Button>} />;
  return <section className="p51-section">
    <div className="p51-section-head"><h2>{target ? 'PLANS' : 'YOUR PLANS'} · {data.length}</h2></div>
    {data.map(p => <div key={p.slug} className="p51-plan-card">
      <Link to="/plans/$slug" params={{ slug: p.slug }} className="cover" aria-hidden tabIndex={-1}>{p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" />}</Link>
      <Link to="/plans/$slug" params={{ slug: p.slug }} className="min-w-0"><strong>{p.name}</strong><small>{p.weeks} weeks · {p.daysPerWeek} days · {p.minutes} min</small><small>{peopleStarted(p.started)}</small></Link>
      <Button variant="ghost" className="p51-dots" aria-label={`Options for ${p.name}`} onClick={() => setMenu(p)}><MoreHorizontal size={18} /></Button>
    </div>)}
    <NewSheet open={!!menu} onOpenChange={o => { if (!o) setMenu(null); }} title={menu?.name ?? 'Plan'} hideTitle>
      <NewSheetRow simple title="Share" leading={<NewSheetMenuIcon><Share /></NewSheetMenuIcon>} onClick={() => { const m = menu; setMenu(null); if (m) void shareLink(`/p/${m.slug}`, m.name); }} />
    </NewSheet>
  </section>;
}

export function MealsTab({ own }: { own: boolean }) {
  return own ? <P51Empty title="Share your typical day" body="Your meals show up here." /> : <P51Empty title="No meals yet" />;
}

export function LockCard({ first, crew }: { first: string; crew: { id: string; name: string } | null }) {
  return <section className="p51-card"><span className="lock"><Lock size={24} /></span><h2>This account is private</h2><p>Follow {first} to see their posts, workouts and meals.</p>
    {crew && <Link to="/crews/$groupId" params={{ groupId: crew.id }} className="p51-crew-row"><Users size={18} className="shrink-0" /><span className="min-w-0 flex-1">You see {first}'s check-ins in {crew.name}</span><span aria-hidden className="text-[var(--new-chevron)]">›</span></Link>}
  </section>;
}

export function ProfileSkeleton() {
  return <div aria-label="Loading profile" aria-busy>
    <section className="new-profile-identity">
      <div className="new-profile-avatar-row"><span className="p51-bone" style={{ width: 84, height: 84 }} /><div className="p51-counts">{[0, 1, 2].map(i => <div key={i} className="flex flex-col items-center gap-1.5"><span className="p51-bone" style={{ width: 28, height: 18, borderRadius: 6 }} /><span className="p51-bone" style={{ width: 52, height: 10 }} /></div>)}</div></div>
      <div className="flex flex-col gap-2"><span className="p51-bone" style={{ width: 120, height: 14 }} /><span className="p51-bone" style={{ width: 220, height: 12 }} /></div>
      <div className="p51-buttons"><span className="p51-bone flex-1" style={{ height: 44 }} /><span className="p51-bone flex-1" style={{ height: 44 }} /></div>
    </section>
    <P51Tabs tab="posts" muted />
    <div className="grid grid-cols-3 gap-[2px] pt-[2px]">{Array.from({ length: 6 }, (_, i) => <span key={i} className="aspect-[4/5] bg-[var(--new-header-border)]" />)}</div>
  </div>;
}
