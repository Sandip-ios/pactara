import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProfileBadges, ProfileStatsTab } from '@/components/profile/ProfileTabs';
import { getMemberProfile } from '@/lib/member-profile.functions';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { NewSheet, NewSheetCheckbox, NewSheetRow } from './NewSheet';
import '@/components/profile/profile.css';

export const profileProgressOptions = (group: string | null) => queryOptions({ queryKey: ['member-profile', null, group], queryFn: () => getMemberProfile({ data: { groupId: group } }) });

/** Reuses the existing Badges and Stats, until the progress redesign in step 6. */
export function NewProfileProgress({ group }: { group: string | null }) {
  const [chosen, setChosen] = useState(group);
  const { data } = useSuspenseQuery(profileProgressOptions(chosen));
  const [tab, setTab] = useState<'stats' | 'badges'>('stats');
  const [picker, setPicker] = useState(false);
  const navigate = useNavigate();
  const scroll = useOpenAtTop();
  useHideBottomTabs(true, false);
  const openLifts = async () => {
    const scrollToLifts = () => {
      const heading = Array.from(document.querySelectorAll('h2')).find(el => el.textContent === 'Your lifts');
      if (!heading) return false;
      heading.scrollIntoView({ block: 'start' }); return true;
    };
    const observer = new MutationObserver(() => { if (scrollToLifts()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 5000);
    try { await navigate({ to: '/workouts' }); window.requestAnimationFrame(() => { if (scrollToLifts()) observer.disconnect(); }); } catch { observer.disconnect(); }
  };
  return <div ref={scroll} data-scroll-root className="redesign-step3 new-profile-page fixed inset-0 overflow-y-auto pb-10">
    <header className="new-profile-header pt-new-top"><div className="new-profile-header-row"><Button variant="ghost" asChild className="new-profile-menu-button"><Link to="/profile" aria-label="Back"><ChevronLeft size={22} /></Link></Button><h1>Your progress</h1><span className="new-profile-header-spacer" /></div></header>
    <div className="new-profile-progress-tabs" role="tablist" aria-label="Progress">{(['stats', 'badges'] as const).map(value => <Button key={value} variant="ghost" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'stats' ? 'Stats' : 'Badges'}</Button>)}</div>
    {tab === 'badges' ? <ProfileBadges earned={data.badges} streak={data.currentStreak} own firstName={data.name.split(' ')[0] || 'You'} freezes={data.streakFreezesAvailable} /> : data.stats && <ProfileStatsTab stats={data.stats} own firstName={data.name.split(' ')[0] || 'You'} crewName={data.groupName ?? 'your crew'} freezes={data.streakFreezesAvailable} switchable={data.sharedGroups.length > 1} onSwitch={() => setPicker(true)} onLifts={() => void openLifts()} />}
    <NewSheet open={picker} onOpenChange={setPicker} title="Pick your crew">{data.sharedGroups.map(crew => <NewSheetRow key={crew.id} simple title={crew.name} trailing={<NewSheetCheckbox checked={crew.id === data.groupId} />} onClick={() => { setChosen(crew.id); setPicker(false); }} />)}</NewSheet>
  </div>;
}