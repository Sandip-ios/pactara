import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Check, ChevronDown, Flame, Snowflake, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getStreakFreezeInfo, applyStreakFreeze } from '@/lib/streak-freezes.functions';
import { showProfileFreeze, type profileWeek } from '@/lib/profile-view';

export function ProfileWeek({ isOwn, groupId, crewName, switchable, onSwitch, today, days, workouts, target, streak, best, freezes }: {
  isOwn: boolean; groupId: string; crewName: string; switchable: boolean; onSwitch: () => void; today: string;
  days: ReturnType<typeof profileWeek>; workouts: number; target: number; streak: number; best: number; freezes: number;
}) {
  const qc = useQueryClient();
  const apply = useServerFn(applyStreakFreeze);
  const info = useQuery({ queryKey: ['streak-freeze-info', groupId], queryFn: () => getStreakFreezeInfo({ data: { groupId } }), enabled: isOwn });
  const freeze = useMutation({ mutationFn: () => apply({ data: { groupId } }), onSuccess: async () => {
    toast.success('Freeze used. Your streak is safe.');
    await Promise.all([qc.invalidateQueries({ queryKey: ['streak-freeze-info'] }), qc.invalidateQueries({ queryKey: ['member-profile'] }), qc.invalidateQueries({ queryKey: ['home-crew'] })]);
  }, onError: (error: Error) => toast.error(error.message) });
  const eligible = info.data?.eligibleDate ?? null;
  const weekday = eligible ? new Date(`${eligible}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : '';
  return <section aria-label="This week" className="profile-card">
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0"><div className="profile-week-label">This week</div><div className="profile-week-count">{workouts} of {target} workouts</div></div>
      {switchable ? <Button variant="ghost" className="profile-control profile-crew-chip" onClick={onSwitch}><span className="truncate">In {crewName}</span><ChevronDown size={14} className="shrink-0" /></Button> : <span className="profile-crew-chip inline-flex items-center"><span className="truncate">In {crewName}</span></span>}
    </div>
    <progress className="profile-progress" aria-label="Weekly goal" role="progressbar" aria-valuenow={workouts} aria-valuemin={0} aria-valuemax={target} max={target} value={Math.min(workouts, target)} />
    <div className="profile-week-days">{days.map((day, i) => {
      const label = new Date(`${day.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      return <div key={day.date} className="profile-week-day"><span aria-label={`${label}, ${day.state === 'done' ? 'checked in' : day.state}`} className={`profile-day profile-day-${day.state}`}>{day.state === 'done' ? <Check size={18} /> : day.state === 'rest' ? 'Rest' : day.state === 'missed' ? '!' : null}</span><span className="profile-day-label">{['M','T','W','T','F','S','S'][i]}</span></div>;
    })}</div>
    <div className="profile-week-chips"><div className="profile-week-chip profile-fire"><Flame size={18} /><span>{streak ? `${streak}-day streak` : 'No streak yet'}</span></div><div className={`profile-week-chip ${isOwn ? 'profile-ice' : 'profile-best'}`}>{isOwn ? <Snowflake size={18} /> : <Trophy size={18} />}<span>{isOwn ? `${info.data?.available ?? freezes} freezes` : `Best ${best} days`}</span></div></div>
    {isOwn && showProfileFreeze(today, eligible, info.data?.available ?? 0) && <div className="profile-freeze"><Snowflake size={20} /><span className="profile-freeze-copy"><strong>You missed {weekday}.</strong> Use a freeze on it to keep your streak alive.</span><Button variant="ghost" className="profile-control profile-freeze-use" disabled={freeze.isPending} onClick={() => freeze.mutate()}>Use freeze</Button></div>}
  </section>;
}