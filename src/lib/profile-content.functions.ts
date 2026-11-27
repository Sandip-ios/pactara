import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { ProfileWorkoutRow } from './profile-state';

const input = (i: unknown) => z.object({ target: z.string().uuid().nullable() }).parse(i);

type Ctx = { supabase: any; userId: string };

/** Someone else's workouts/plans are readable only when their profile content is unlocked for you. */
async function canSeeContent({ supabase, userId }: Ctx, target: string): Promise<boolean> {
  if (target === userId) return true;
  const { data } = await supabase.rpc('get_profile', { target });
  const p = data as { relationship?: string; is_private?: boolean } | null;
  if (!p || p.relationship === 'blocked') return false;
  return !p.is_private || p.relationship === 'following';
}

/** Profile Workouts tab: own saved workouts, or someone else's listed workouts. */
export const getProfileWorkouts = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(input)
  .handler(async ({ context, data }): Promise<ProfileWorkoutRow[]> => {
    const { supabase, userId } = context;
    const target = data.target ?? userId;
    if (!(await canSeeContent(context, target))) return [];
    const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
    const { estimateMinutes } = await import('./workout-builder');
    const { musclesOf, MUSCLE_CHIPS } = await import('./discover-workouts');
    type Item = { exerciseId: string; sets: number };
    let rows: { id: string; code: string | null; name: string; items: Item[]; sourceUser: string | null }[];
    if (target === userId) {
      const { data: mine, error } = await supabase.from('workouts').select('id, name, exercises, source_user_id, created_at').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw new Error('Could not load workouts');
      const ids = (mine ?? []).map((w: any) => w.id);
      const { data: shares } = ids.length ? await admin.from('shared_workouts').select('code, workout_id').in('workout_id', ids) : { data: [] };
      const codeOf = new Map<string, string>();
      for (const s of shares ?? []) if (s.workout_id && !codeOf.has(s.workout_id)) codeOf.set(s.workout_id, s.code);
      rows = (mine ?? []).map((w: any) => ({ id: w.id, code: codeOf.get(w.id) ?? null, name: w.name, items: Array.isArray(w.exercises) ? w.exercises : [], sourceUser: w.source_user_id }));
    } else {
      const { data: shares, error } = await admin.from('shared_workouts').select('code, name, exercises, workout_id, created_at').eq('owner_id', target).eq('discover', true).not('workout_id', 'is', null).order('created_at', { ascending: false });
      if (error) throw new Error('Could not load workouts');
      rows = (shares ?? []).map((s: any) => ({ id: s.workout_id, code: s.code, name: s.name, items: Array.isArray(s.exercises) ? s.exercises : [], sourceUser: null }));
    }
    const codes = rows.map(r => r.code).filter((c): c is string => !!c);
    const [copies, mineCopies, facts, sources] = await Promise.all([
      codes.length ? admin.from('workouts').select('source_share_code').in('source_share_code', codes) : Promise.resolve({ data: [] as any[] }),
      codes.length && target !== userId ? supabase.from('workouts').select('id, source_share_code').eq('user_id', userId).in('source_share_code', codes) : Promise.resolve({ data: [] as any[] }),
      (async () => { const ids = [...new Set(rows.flatMap(r => r.items.map(i => i.exerciseId)))]; return ids.length ? admin.from('exercises').select('id, primary_muscles').in('id', ids) : { data: [] as any[] }; })(),
      (async () => { const ids = [...new Set(rows.map(r => r.sourceUser).filter((x): x is string => !!x && x !== userId))]; return ids.length ? admin.from('profiles').select('id, name').in('id', ids) : { data: [] as any[] }; })(),
    ]);
    const saves = new Map<string, number>();
    for (const c of copies.data ?? []) saves.set(c.source_share_code, (saves.get(c.source_share_code) ?? 0) + 1);
    const myCopy = new Map<string, string>((mineCopies.data ?? []).map((c: any) => [c.source_share_code, c.id]));
    const prim = new Map<string, string[]>((facts.data ?? []).map((e: any) => [e.id, e.primary_muscles ?? []]));
    const names = new Map<string, string>((sources.data ?? []).map((p: any) => [p.id, (p.name ?? '').trim()]));
    const label = (k: string) => MUSCLE_CHIPS.find(m => m.key === k)?.label ?? 'Full body';
    return rows.map(r => {
      const muscles = musclesOf(r.items.flatMap(i => prim.get(i.exerciseId) ?? []));
      const sets = r.items.reduce((a, i) => a + Math.max(0, Number(i.sets) || 0), 0);
      return {
        id: r.id, code: r.code, name: r.name, exercises: r.items.length, minutes: estimateMinutes(sets),
        fromName: r.sourceUser ? names.get(r.sourceUser) || null : null,
        saves: r.code ? saves.get(r.code) ?? 0 : 0,
        muscle: muscles.length === 1 || muscles.length === 2 ? label(muscles[0]!) : 'Full body',
        myCopyId: r.code ? myCopy.get(r.code) ?? null : null,
      };
    });
  });

export type ProfilePlanRow = { slug: string; name: string; coverUrl: string | null; weeks: number; daysPerWeek: number; minutes: string; started: number; status: string };

/** Profile Plans tab: plans this member has started (newest run per plan). */
export const getProfilePlans = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(input)
  .handler(async ({ context, data }): Promise<ProfilePlanRow[]> => {
    const { userId } = context;
    const target = data.target ?? userId;
    if (!(await canSeeContent(context, target))) return [];
    const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
    const { data: runs, error } = await admin.from('user_plans').select('plan_id, status, created_at, plans!inner(slug, name, cover_url, weeks, days_per_week, minutes, is_published)').eq('user_id', target).eq('plans.is_published', true).order('created_at', { ascending: false });
    if (error) throw new Error('Could not load plans');
    const seen = new Set<string>();
    const list = (runs ?? []).filter((r: any) => !seen.has(r.plan_id) && seen.add(r.plan_id));
    const counts = await Promise.all(list.map((r: any) => admin.from('user_plans').select('user_id', { count: 'exact', head: true }).eq('plan_id', r.plan_id)));
    return list.map((r: any, i: number) => ({
      slug: r.plans.slug, name: r.plans.name, coverUrl: r.plans.cover_url, weeks: r.plans.weeks, daysPerWeek: r.plans.days_per_week,
      minutes: String(r.plans.minutes ?? ''), started: counts[i]?.count ?? 0, status: r.status,
    }));
  });
