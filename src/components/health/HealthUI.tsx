import { useEffect, useState, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { Heart } from 'lucide-react';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { healthStats, healthClock, healthWorkoutIcon, healthWorkoutName, type HealthWorkout } from '@/lib/health-workouts';
import { Button } from '@/components/ui/button';

export function HealthIcon() { return <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card"><Heart className="h-8 w-8 fill-health-heart text-health-heart" /></span>; }
export function HealthSheet({ open, onOpenChange, title, sub, children, leading }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; sub: string; children: ReactNode; leading?: ReactNode }) {
  useHideBottomTabs(open);
  return <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
    <Drawer.Portal><Drawer.Overlay className="fixed inset-0 z-[120] bg-health-overlay" />
      <Drawer.Content className="ph-no-capture ph-mask fixed inset-x-0 bottom-0 z-[121] mx-auto flex max-h-[85dvh] max-w-lg flex-col rounded-t-[24px] bg-card px-5 pb-[max(20px,env(safe-area-inset-bottom))] text-health-ink">
        <div className="mx-auto my-3 h-1 w-10 rounded-full bg-border" />
        {leading && <div className="mb-4">{leading}</div>}
        <Drawer.Title className="text-[22px] font-extrabold">{title}</Drawer.Title>
        <Drawer.Description className="mt-1 text-[14px] text-health-muted">{sub}</Drawer.Description>
        <div className="mt-5 overflow-y-auto">{children}</div>
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>;
}
export function HealthWorkoutRow({ workout, onUse, detailed = false, locale = 'en-US' }: { workout: HealthWorkout; onUse: () => void; detailed?: boolean; locale?: string }) {
  return <div className="ph-no-capture ph-mask flex items-center gap-2 py-3">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-health-surface text-xl" aria-hidden>{healthWorkoutIcon(workout.type)}</span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[15px] font-bold text-health-ink">{healthWorkoutName(workout.type)}</p>
      <p className="text-[12px] text-health-muted">{healthClock(workout.start, locale)} · {detailed ? workout.source : healthStats(workout, locale, false)}</p>
      {detailed && <p className="mt-0.5 text-[13px] font-semibold text-health-muted">{healthStats(workout, locale)}</p>}
    </div>
    <Button onClick={onUse} className="h-9 shrink-0 rounded-full bg-health-purple px-4 font-bold text-health-on-purple">Use</Button>
  </div>;
}
export function HealthPostedStats({ workout, locale }: { workout: HealthWorkout; locale?: string }) {
  const [phoneLocale, setPhoneLocale] = useState('en-US');
  useEffect(() => setPhoneLocale(navigator.language), []);
  return <div className="ph-no-capture ph-mask flex flex-wrap items-center gap-x-2 gap-y-1 py-3 text-[13px] font-semibold text-health-muted">
    <span aria-hidden>{healthWorkoutIcon(workout.type)}</span><span>{healthClock(workout.start, locale ?? phoneLocale)} · {healthStats(workout, locale ?? phoneLocale)}</span>
    <span className="rounded-full bg-health-surface px-2 py-1 text-[11px] font-medium">{workout.source}</span>
  </div>;
}