import { progressSummary } from '@/lib/redesign-profile';
import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, Flame, Lock, Menu, Pencil, Settings, ShieldBan, Snowflake, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getHomeCrew } from '@/lib/home-crew.functions';
import { newProfileWeek, profileWeekChips } from '@/lib/redesign-profile';
import { cn } from '@/lib/utils';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { useStatusBarScrollToTop } from '@/lib/status-bar-scroll';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { ownNewProfileOptions } from './profile-query';
import { NewSheet, NewSheetCheckbox, NewSheetChevron, NewSheetRow } from './NewSheet';
import { NewAvatarFallback } from './NewAvatarFallback';

export function NewProfileAvatar({ url, size }: { url: string | null; size: 84 | 96 }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className={`new-profile-avatar avatar-${size}`} aria-label="Your photo">
    {url && url !== failedUrl ? <img src={url} alt="Your profile" onError={() => setFailedUrl(url)} /> : <NewAvatarFallback />}
  </span>;
}

export function NewOwnProfile() {
  const navigate = useNavigate();
  const { data: profile } = useSuspenseQuery(ownNewProfileOptions);
  const scroll = useOpenAtTop();
  useStatusBarScrollToTop();
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  useHideBottomTabs(menu || picker);
  const [chosen, setChosen] = useState<string | null>(null);
  const groupId = profile.crews.find(crew => crew.id === chosen)?.id ?? profile.crews[0]?.id ?? null;
  const crewName = profile.crews.find(crew => crew.id === groupId)?.name ?? '';
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-profile-page fixed inset-0 overflow-y-auto overscroll-none pb-[calc(104px+env(safe-area-inset-bottom))]">
    <header className="new-profile-header pt-new-top"><div className="new-profile-header-row"><span className="new-profile-header-spacer" /><h1>{profile.username || profile.name.trim().split(/\s+/)[0]}</h1><Button variant="ghost" className="new-profile-menu-button" aria-label="Profile menu" onClick={() => setMenu(true)}><Menu size={22} /></Button></div></header>
    <section className="new-profile-identity">
      <div className="new-profile-avatar-row"><NewProfileAvatar url={profile.avatarUrl} size={84} /><div className="new-profile-counts"><Button variant="ghost" asChild className="new-profile-stat"><Link to="/u/$userId/follows" params={{ userId: profile.id }} search={{ socialTab: 'followers' }}><strong>{profile.followers}</strong><span>followers</span></Link></Button><Button variant="ghost" asChild className="new-profile-stat"><Link to="/u/$userId/follows" params={{ userId: profile.id }} search={{ socialTab: 'following' }}><strong>{profile.following}</strong><span>following</span></Link></Button></div></div>
      <div><h2 className="new-profile-name">{profile.name.trim() || profile.username}</h2>{profile.bio && <p className="new-profile-bio">{profile.bio}</p>}<div className="new-profile-progress-link">{profile.streak > 0 && <Flame size={14} aria-hidden />}{progressSummary(profile.streak, profile.badges) && <span>{progressSummary(profile.streak, profile.badges)}</span>}<Link to="/profile/progress">See progress ›</Link></div></div>
      <Button variant="ghost" asChild className="new-profile-edit-button"><Link to="/profile/edit"><Pencil size={17} />Edit profile</Link></Button>
      {profile.plan && <Button variant="ghost" asChild className="new-profile-plan"><Link to="/plans/$slug" params={{ slug: profile.plan.slug }}><span className="new-profile-plan-cover">{profile.plan.coverUrl && <img src={profile.plan.coverUrl} alt="" />}</span><span className="min-w-0 flex-1"><strong>On {profile.plan.name}</strong><small>Week {profile.plan.week} of {profile.plan.weeks}</small></span><ChevronRight size={20} /></Link></Button>}
    </section>
    {groupId && <NewProfileWeekCard groupId={groupId} crewName={crewName} showPicker={profile.crews.length > 1} onPick={() => setPicker(true)} freezes={profile.freezes} />}
    <div className="new-profile-note"><Lock size={18} aria-hidden /><p>Your crews always see your check-ins. Only you choose what goes on your public profile.</p></div>
    <NewSheet open={menu} onOpenChange={setMenu} title="Profile" hideTitle description="Your profile menu">
      <NewSheetRow simple className="border-b-0" title="Account privacy" leading={<Lock />} trailing={<><span className="text-[14px] font-normal text-[var(--new-muted)]">{profile.isPrivate ? 'Private' : 'Public'}</span><NewSheetChevron /></>} onClick={() => { setMenu(false); void navigate({ to: '/profile/privacy' }); }} />
      {profile.isPrivate && <NewSheetRow simple title="Follow requests" leading={<Users />} trailing={<NewSheetChevron />} onClick={() => { setMenu(false); void navigate({ to: '/follow-requests' }); }} />}
      <NewSheetRow simple className="border-b-0" title="Blocked people" leading={<ShieldBan />} trailing={<NewSheetChevron />} onClick={() => { setMenu(false); void navigate({ to: '/account-settings/blocked' }); }} />
      <div className="new-profile-menu-divider" />
      <NewSheetRow simple title="Settings" leading={<Settings />} trailing={<NewSheetChevron />} onClick={() => { setMenu(false); void navigate({ to: '/account-settings' }); }} />
    </NewSheet>
    <NewSheet open={picker} onOpenChange={setPicker} title="Pick your crew" description="Choose which crew counts this week">
      {profile.crews.map(group => <NewSheetRow key={group.id} simple title={group.name} trailing={<NewSheetCheckbox checked={group.id === groupId} />} onClick={() => { setChosen(group.id); setPicker(false); }} />)}
    </NewSheet>
  </div>;
}

/** This week card shared by your own profile and a crewmate's profile (memberId set). */
export function NewProfileWeekCard({ groupId, crewName, showPicker, onPick, freezes, memberId }: {
  groupId: string; crewName: string; showPicker: boolean; onPick: () => void; freezes: number | null; memberId?: string;
}) {
  const { data: crew } = useQuery({ queryKey: ['home-crew', groupId], queryFn: () => getHomeCrew({ data: { groupId } }), staleTime: 30_000 });
  const me = crew?.members.find(member => memberId ? member.userId === memberId : member.isYou);
  const chips = profileWeekChips(me?.streak, freezes);
  return <section className="new-profile-week" aria-label="This week">
    <div className="new-profile-week-heading"><div><h2>THIS WEEK</h2><strong>{me?.workouts ?? 0} of {me?.target ?? crew?.weeklyTarget ?? 0} workouts</strong></div>{showPicker && <Button variant="ghost" className="new-profile-crew-pill" onClick={onPick}><span>In {crewName}</span><ChevronDown size={14} /></Button>}</div>
    <progress className="new-profile-week-progress" aria-label="This week's workouts" value={Math.min(me?.workouts ?? 0, me?.target ?? 1)} max={Math.max(1, me?.target ?? 1)} />
    {me ? <div className="new-profile-week-days">{newProfileWeek(me).map((day, index) => <div key={day.date}><span className={`new-profile-day ${day.state}`} aria-label={`${day.date}: ${day.state}`}>{day.state === 'checked' ? <Check size={18} /> : day.state === 'rest' ? 'Rest' : day.state === 'freeze' ? <Snowflake size={16} /> : null}</span><small>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</small></div>)}</div> : <div className="h-[57px]" aria-label="Loading week" />}
    {chips.any && <div className={cn('new-profile-week-chips', chips.single && 'new-profile-week-chips-single')}>{chips.streak && <span className="new-profile-streak-chip"><Flame size={17} /><span>{me?.streak}-day streak</span></span>}{chips.freezes && <span className="new-profile-freeze-chip"><Snowflake size={17} /><span>{freezes} freezes</span></span>}</div>}
  </section>;
}
