import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { HealthIcon } from '@/components/health/HealthUI';
import { useAppleHealth } from '@/lib/use-apple-health';
import { openAppleHealth } from '@/lib/apple-health';
import { healthClock } from '@/lib/health-workouts';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';

export const Route = createFileRoute('/_authenticated/apple-health')({
  head: () => ({ meta: [
    { title: 'Apple Health | Pactara' },
    { name: 'description', content: 'Manage your Apple Health workout connection in Pactara.' },
    { property: 'og:title', content: 'Apple Health | Pactara' },
    { property: 'og:description', content: 'Manage your Apple Health workout connection in Pactara.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: AppleHealthPage,
});
function AppleHealthPage() {
  const health = useAppleHealth(); const navigate = useNavigate(); const ref = useOpenAtTop();
  useHideBottomTabs(true, false);
  useEffect(() => { if (health.ready && !health.available) void navigate({ to: '/profile', replace: true }); }, [health.ready, health.available, navigate]);
  if (!health.available) return null;
  return <div ref={ref} data-scroll-root className="ph-no-capture ph-mask fixed inset-0 z-50 overflow-y-auto bg-health-surface pb-[max(24px,env(safe-area-inset-bottom))] text-health-ink">
    <header className="sticky top-0 bg-health-surface pt-[env(safe-area-inset-top)]">
      <div className="relative flex h-14 items-center justify-center">
        <Button variant="ghost" size="icon" aria-label="Back to Profile" onClick={() => navigate({ to: '/profile' })} className="absolute left-4"><ChevronLeft /></Button>
        <h1 className="text-[17px] font-extrabold">Apple Health</h1>
      </div>
    </header>
    <main className="mx-auto max-w-lg space-y-4 px-4 pt-4">
      <section className="flex items-center gap-3 rounded-[20px] bg-card p-4">
        <HealthIcon /><div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[17px] font-bold">{health.connected && <span className="h-2 w-2 rounded-full bg-health-green" />}{health.connected ? 'Connected' : 'Not connected'}</p>
          {health.connected && health.lastSynced && <p className="mt-1 text-[13px] text-health-muted">Last synced {healthClock(health.lastSynced)}</p>}
          {!health.connected && <Button disabled={health.busy} onClick={() => health.connect()} className="mt-2 h-auto min-h-10 whitespace-normal rounded-full bg-health-purple text-health-on-purple">Connect Apple Health</Button>}
        </div>
      </section>
      {health.error && <p role="alert" className="text-[13px] text-health-muted">{health.error}</p>}
      <section className="rounded-[20px] bg-card p-4">
        <div className="flex items-start gap-3">
          <label htmlFor="health-show-workouts" className="flex-1"><span className="block text-[15px] font-bold">Show my workouts from Health</span><span className="mt-1 block text-[13px] text-health-muted">Runs, rides and classes from your Watch and other apps, ready to check in.</span></label>
          <Switch id="health-show-workouts" disabled={!health.connected || health.busy} checked={health.prefs?.showWorkouts ?? true} onCheckedChange={show => health.update(health.connected, show)} className="data-[state=checked]:bg-health-purple" />
        </div>
      </section>
      <section className="rounded-[20px] bg-card p-4">
        <h2 className="text-[15px] font-bold">Change what Pactara can read</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-health-muted">Apple keeps these settings in the Health app: Profile › Apps › Pactara.</p>
        <Button variant="outline" onClick={() => openAppleHealth()} className="mt-4 h-11 w-full rounded-full text-health-purple">Open the Health app</Button>
      </section>
      <p className="px-2 text-center text-[12px] leading-relaxed text-health-muted">Workouts stay on your phone until you post. Your crew only sees what you post.</p>
    </main>
  </div>;
}