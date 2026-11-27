import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { useAppleHealth } from '@/lib/use-apple-health';
import { markHealthPromptSeen } from '@/lib/apple-health.functions';
import { healthPromptEligible } from '@/lib/health-workouts';
import { Button } from '@/components/ui/button';
import { HealthIcon, HealthSheet } from './HealthUI';

export function HealthPrompt({ firstCheckIn, onFinish }: { firstCheckIn: boolean; onFinish?: () => void }) {
  const health = useAppleHealth(); const mark = useServerFn(markHealthPromptSeen); const client = useQueryClient();
  const shown = useRef(false); const finished = useRef(false); const [open, setOpen] = useState(false);
  const finish = () => { if (!finished.current) { finished.current = true; onFinish?.(); } };
  const changeOpen = (next: boolean) => { setOpen(next); if (!next) finish(); };
  useEffect(() => {
    if (!health.userId || !health.prefs || shown.current) return;
    const key = `pactara:health-prompt:${health.userId}`;
    let seen = health.prefs.seen; try { seen ||= localStorage.getItem(key) === '1'; } catch { /* profile still applies */ }
    if (!healthPromptEligible(firstCheckIn, seen, health.connected, health.available)) { finish(); return; }
    shown.current = true; setOpen(true);
    try { localStorage.setItem(key, '1'); } catch { /* optional fallback */ }
    void mark().then(() => client.invalidateQueries({ queryKey: ['apple-health', health.userId, 'preferences'] })).catch(() => {});
  }, [firstCheckIn, health.userId, health.prefs, health.connected, health.available, mark, client]);
  return <HealthSheet open={open} onOpenChange={changeOpen} title="Wear an Apple Watch?" sub="Next time, skip typing your stats." leading={<HealthIcon />}>
    <p className="text-[15px] leading-relaxed">Connect Apple Health and your runs, rides and classes show up on Home with time, distance and calories filled in. You just add the video.</p>
    <p className="my-4 text-[12px] text-health-muted">Your crew only sees what you post. Change it anytime in Profile.</p>
    {health.error && <p role="alert" className="mb-3 text-[13px] text-health-muted">{health.error}</p>}
    <Button disabled={health.busy} onClick={async () => { if (await health.connect()) changeOpen(false); }} className="h-12 w-full rounded-full bg-health-purple text-[16px] font-bold text-health-on-purple">Connect Apple Health</Button>
    <Button variant="ghost" onClick={() => changeOpen(false)} className="mt-2 h-11 w-full text-health-purple">Not now</Button>
  </HealthSheet>;
}