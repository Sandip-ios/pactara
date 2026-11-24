import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const getHealthPreferences = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context: { supabase, userId } }) => {
  const [prefs, profile, used, today] = await Promise.all([
    supabase.from('health_preferences').select('connected, show_workouts').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('health_prompt_seen_at, timezone').eq('id', userId).single(),
    supabase.from('check_ins').select('health_workout').eq('user_id', userId).not('health_workout', 'is', null),
    supabase.from('check_ins').select('checkin_date').eq('user_id', userId).order('checkin_date', { ascending: false }).limit(1),
  ]);
  if (prefs.error || profile.error || used.error || today.error) throw new Error('Could not load Health settings');
  const { localDateIn } = await import('./streak-rules');
  return { userId, connected: prefs.data?.connected ?? false, showWorkouts: prefs.data?.show_workouts ?? true, seen: !!profile.data.health_prompt_seen_at,
    used: (used.data ?? []).flatMap(r => { const v = r.health_workout; return v && typeof v === 'object' && !Array.isArray(v) && typeof v['uuid'] === 'string' ? [v['uuid']] : []; }),
    checkedInToday: today.data?.[0]?.checkin_date === localDateIn(profile.data.timezone, new Date()),
  };
});
export const saveHealthPreferences = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ connected: z.boolean(), showWorkouts: z.boolean() }).parse(input))
  .handler(async ({ data, context: { supabase, userId } }) => {
    const { error } = await supabase.from('health_preferences').upsert({ user_id: userId, connected: data.connected, show_workouts: data.showWorkouts });
    if (error) throw new Error('Could not save Health settings'); return { ok: true };
  });
export const markHealthPromptSeen = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context: { supabase, userId } }) => {
  const { error } = await supabase.from('profiles').update({ health_prompt_seen_at: new Date().toISOString() }).eq('id', userId).is('health_prompt_seen_at', null);
  if (error) throw new Error('Could not save Health prompt'); return { ok: true };
});