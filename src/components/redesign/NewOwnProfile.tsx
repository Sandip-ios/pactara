import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Bookmark, ChevronRight, Lock, Menu, Settings, ShieldBan, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { completeProfileSteps, ownInfoLine } from '@/lib/profile-state';
import { useAvatarPicker } from '@/components/profile/use-avatar-picker';
import { Camera, Check, FileText, UserPlus } from 'lucide-react';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { useStatusBarScrollToTop } from '@/lib/status-bar-scroll';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { getMySocialPosts } from '@/lib/posts.functions';
import { profileGridTiles } from '@/lib/saved-posts';
import { ownNewProfileOptions } from './profile-query';
import { NewSheet, NewSheetChevron, NewSheetRow } from './NewSheet';
import { NewAvatarFallback } from './NewAvatarFallback';
import { MealsTab, OwnWorkoutsTab, P51Avatar, P51Header, P51PostsGrid, P51Stats, P51Tabs, PlansTab, shareLink, type ProfileTab } from './NewProfileParts';

export function NewProfileAvatar({ url, size }: { url: string | null; size: 84 | 96 }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className={`new-profile-avatar avatar-${size}`} aria-label="Your photo">
    {url && url !== failedUrl ? <img src={url} alt="Your profile" onError={() => setFailedUrl(url)} /> : <NewAvatarFallback />}
  </span>;
}

export function NewOwnProfile({ tab, onTab }: { tab: ProfileTab; onTab: (t: ProfileTab) => void }) {
  const navigate = useNavigate();
  const { data: profile } = useSuspenseQuery(ownNewProfileOptions);
  const { data: posts } = useQuery({ queryKey: ['my-social-posts'], queryFn: () => getMySocialPosts(), staleTime: 30_000 });
  const scroll = useOpenAtTop();
  useStatusBarScrollToTop();
  const [menu, setMenu] = useState(false);
  useHideBottomTabs(menu);
  const handle = profile.username || profile.name.trim().split(/\s+/)[0] || 'You';
  const line = ownInfoLine(profile.streak, profile.badges);
  const go = (to: '/saved' | '/profile/privacy' | '/follow-requests' | '/account-settings/blocked' | '/account-settings') => { setMenu(false); void navigate({ to }); };
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-profile-page fixed inset-0 overflow-y-auto overscroll-none pb-[calc(104px+env(safe-area-inset-bottom))]">
    <P51Header title={`@${handle}`} left={null} right={<Button variant="ghost" className="p51-round" aria-label="Profile menu" onClick={() => setMenu(true)}><Menu size={22} /></Button>} />
    <section className="new-profile-identity">
      <div className="new-profile-avatar-row"><P51Avatar url={profile.avatarUrl} label="Your photo" /><P51Stats userId={profile.id} posts={posts?.length ?? 0} followers={profile.followers} following={profile.following} listsOpen /></div>
      <div>
        <h2 className="new-profile-name">{profile.name.trim() || profile.username}</h2>
        {profile.bio && <p className="new-profile-bio">{profile.bio}</p>}
        <p className="p51-line">{line && <Link to="/profile/progress" className="!text-inherit !font-normal">{line}</Link>}<Link to="/profile/progress">See progress ›</Link></p>
      </div>
      <div className="p51-buttons">
        <Button variant="ghost" asChild className="p51-btn light"><Link to="/profile/edit">Edit profile</Link></Button>
        <Button variant="ghost" className="p51-btn light" onClick={() => void shareLink(`/u/${profile.username || profile.id}`, profile.name)}>Share profile</Button>
      </div>
      {profile.plan && <Link to="/plans/$slug" params={{ slug: profile.plan.slug }} className="p51-plan"><span className="p51-plan-cover">{profile.plan.coverUrl && <img src={profile.plan.coverUrl} alt="" />}</span><span className="min-w-0 flex-1"><strong>On {profile.plan.name}</strong><small>Week {profile.plan.week} of {profile.plan.weeks} · others can view and start it</small></span><ChevronRight size={20} className="shrink-0 text-[var(--new-chevron)]" /></Link>}
    </section>
    <CompleteProfile bio={profile.bio} following={profile.following} posts={posts?.length ?? null} hasPhoto={!!profile.avatarUrl} />
    <P51Tabs tab={tab} onTab={onTab} />
    {tab === 'posts' && <P51PostsGrid tiles={posts ? profileGridTiles(posts, 'Your post') : undefined} emptyBody="Your workouts, meals and photos show up here." />}
    {tab === 'workouts' && <OwnWorkoutsTab />}
    {tab === 'plans' && <PlansTab target={null} />}
    {tab === 'meals' && <MealsTab own />}
    <NewSheet open={menu} onOpenChange={setMenu} title="Profile" hideTitle description="Your profile menu">
      <NewSheetRow simple className="border-b-0" title="Saved" leading={<Bookmark />} trailing={<NewSheetChevron />} onClick={() => go('/saved')} />
      <NewSheetRow simple className="border-b-0" title="Account privacy" leading={<Lock />} trailing={<><span className="text-[14px] font-normal text-[var(--new-muted)]">{profile.isPrivate ? 'Private' : 'Public'}</span><NewSheetChevron /></>} onClick={() => go('/profile/privacy')} />
      {profile.isPrivate && <NewSheetRow simple title="Follow requests" leading={<Users />} trailing={<NewSheetChevron />} onClick={() => go('/follow-requests')} />}
      <NewSheetRow simple className="border-b-0" title="Blocked people" leading={<ShieldBan />} trailing={<NewSheetChevron />} onClick={() => go('/account-settings/blocked')} />
      <div className="new-profile-menu-divider" />
      <NewSheetRow simple title="Settings" leading={<Settings />} trailing={<NewSheetChevron />} onClick={() => go('/account-settings')} />
    </NewSheet>
  </div>;
}

const STEP_ICON = { bio: FileText, friends: UserPlus, post: Camera, photo: Camera } as const;

/** Board 15: shown between the buttons and the tabs until all four steps are done. */
function CompleteProfile({ bio, following, posts, hasPhoto }: { bio: string | null; following: number; posts: number | null; hasPhoto: boolean }) {
  const qc = useQueryClient();
  const avatar = useAvatarPicker();
  if (posts === null) return null;
  const setup = completeProfileSteps({ bio, following, posts, hasPhoto });
  if (!setup) return null;
  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => { await avatar.onChange(e); void qc.invalidateQueries({ queryKey: ['new-own-profile'] }); };
  return <section className="p51-setup" aria-label="Complete your profile">
    <div className="p51-setup-head"><h2>Complete your profile</h2><span>{setup.done} of 4 done</span></div>
    <div className="p51-setup-row">{setup.steps.map(s => { const Icon = STEP_ICON[s.key]; return <div key={s.key} className={`p51-setup-card${s.done ? ' is-done' : ''}`}>
      <span className="ic">{s.done ? <Check size={22} strokeWidth={3} /> : <Icon size={20} />}</span><strong>{s.title}</strong>
      {s.done ? <span className="act">Done</span>
        : s.key === 'bio' ? <Link to="/profile/edit" className="act">{s.action}</Link>
        : s.key === 'friends' ? <Link to="/groups" className="act">{s.action}</Link>
        : s.key === 'post' ? <Link to="/post/new" className="act">{s.action}</Link>
        : <button type="button" className="act" disabled={avatar.uploading} onClick={avatar.pick}>{s.action}</button>}
    </div>; })}</div>
    <input ref={avatar.input} type="file" accept="image/*" hidden onChange={e => void onPhoto(e)} />
  </section>;
}
