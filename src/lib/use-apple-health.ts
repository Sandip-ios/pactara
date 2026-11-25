import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { appleHealthAvailable, connectAppleHealth, readAppleHealthToday } from './apple-health';
import { getHealthPreferences, saveHealthPreferences } from './apple-health.functions';
import { unusedHealthWorkouts } from './health-workouts';

export function useAppleHealth() {
  const [available, setAvailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useQueryClient();
  const get = useServerFn(getHealthPreferences); const save = useServerFn(saveHealthPreferences);
  useEffect(() => {
    let cancelled = false;
    void appleHealthAvailable().then(async ok => {
      if (cancelled) return;
      setAvailable(ok); setReady(true);
      if (ok) { const { data } = await supabase.auth.getUser(); if (!cancelled) setUserId(data.user?.id ?? null); }
    });
    return () => { cancelled = true; };
  }, []);
  const prefs = useQuery({ queryKey: ['apple-health', userId, 'preferences'], queryFn: () => get(), enabled: available && !!userId, staleTime: 30000 });
  const sync = useQuery({ queryKey: ['apple-health', userId, 'today'], queryFn: async () => {
    const result = await readAppleHealthToday();
    return { ...result, syncedAt: result.ok ? new Date().toISOString() : null };
  }, enabled: available && !!userId && !!prefs.data?.connected && !!prefs.data.showWorkouts, staleTime: 60000, refetchInterval: 60000 });
  const connected = !!prefs.data?.connected && sync.data?.ok !== false;
  const workouts = unusedHealthWorkouts(sync.data?.workouts ?? [], prefs.data?.used ?? [], new Date());
  async function update(connected: boolean, showWorkouts: boolean) {
    setBusy(true); setError(null);
    try { await save({ data: { connected, showWorkouts } }); await client.invalidateQueries({ queryKey: ['apple-health', userId] }); }
    catch { setError('Could not save your Health settings. Please try again.'); }
    finally { setBusy(false); }
  }
  async function connect() {
    setBusy(true); setError(null);
    const ok = await connectAppleHealth();
    if (ok) await update(true, true);
    else { setError('Health access is unavailable. You can change permissions in the Health app.'); setBusy(false); }
    return ok;
  }
  return { ready, available: available && !prefs.isError && sync.data?.ok !== false, userId, prefs: prefs.data, connected, workouts, lastSynced: sync.data?.syncedAt ?? null, busy, error, connect, update };
}