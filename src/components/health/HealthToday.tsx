import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppleHealth } from '@/lib/use-apple-health';
import { attachHealthWorkout } from '@/lib/apple-health';
import { clearPlanCheckIn } from '@/lib/plan-checkin';
import { clearWorkoutCheckIn } from '@/lib/active-workout';
import { HealthSheet, HealthWorkoutRow } from './HealthUI';
import type { HealthWorkout } from '@/lib/health-workouts';

export function HealthToday() {
  const health = useAppleHealth(); const navigate = useNavigate(); const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState('en-US'); useEffect(() => setLocale(navigator.language), []);
  const latest = health.workouts[0];
  if (!health.available || !health.connected || !health.prefs?.showWorkouts || health.prefs.checkedInToday || !latest) return null;
  const use = (workout: HealthWorkout) => {
    if (!health.userId) return;
    clearPlanCheckIn(); clearWorkoutCheckIn(); attachHealthWorkout(health.userId, workout); setOpen(false);
    void navigate({ to: '/check-in/camera' });
  };
  return <>
    <div className="rounded-2xl bg-health-surface px-3 py-2">
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[10px] font-extrabold text-health-muted"><Heart size={12} className="fill-health-heart text-health-heart" />FROM APPLE HEALTH TODAY</span>
        {health.workouts.length > 1 && <Button variant="ghost" onClick={() => setOpen(true)} className="h-8 px-1 text-[12px] font-bold text-health-purple">See all {health.workouts.length}</Button>}
      </div>
      <HealthWorkoutRow workout={latest} locale={locale} onUse={() => use(latest)} />
    </div>
    <HealthSheet open={open} onOpenChange={setOpen} title="Today in Apple Health" sub="Pick one to check in with. Its stats go on your post.">
      {health.workouts.map(w => <HealthWorkoutRow key={w.uuid} workout={w} detailed locale={locale} onUse={() => use(w)} />)}
      <p className="mt-5 text-center text-[12px] text-health-muted">Workouts you already checked in with don't show here.</p>
    </HealthSheet>
  </>;
}