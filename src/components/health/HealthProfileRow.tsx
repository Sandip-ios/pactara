import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Heart, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppleHealth } from '@/lib/use-apple-health';
import { appleHealthDiagnostics, isAppleHealthPlatform } from '@/lib/apple-health';
export function HealthProfileRow() {
  const health = useAppleHealth();
  // TODO: remove Apple Health diagnostics after debugging
  const showDiag = isAppleHealthPlatform() && health.ready && !health.available;
  const [diag, setDiag] = useState<string | null>(null);
  useEffect(() => { if (showDiag) void appleHealthDiagnostics().then(setDiag); }, [showDiag]);
  if (showDiag) {
    const p = health.prefsQuery; const s = health.syncQuery;
    const line = `${diag ?? 'checking...'} prefsErr:${p.isError ? `yes(${p.error instanceof Error ? p.error.message : String(p.error)})` : 'no'} syncOk:${s.data ? String(s.data.ok) : '-'}`;
    return <div className="mt-3 w-full rounded-2xl bg-health-surface px-4 py-3 text-health-ink opacity-50">
      <span className="flex items-center gap-3 font-medium"><Heart className="size-4 fill-health-heart text-health-heart" />Apple Health</span>
      <p className="mt-1 break-all text-xs">{line}</p>
    </div>;
  }
  // END TODO
  if (!health.available) return null;
  return <Button variant="ghost" asChild className="mt-3 h-12 w-full justify-between rounded-2xl bg-health-surface px-4 text-health-ink">
    <Link to="/apple-health"><span className="flex items-center gap-3"><Heart className="fill-health-heart text-health-heart" />Apple Health</span><ChevronRight /></Link>
  </Button>;
}
