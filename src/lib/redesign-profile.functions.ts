import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { newProfileEditSchema, saveNewProfileFields, usernameSchema } from './redesign-profile';

export const getOwnRedesignProfile = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabase, userId } = context;
  const [identity, prefs, relation, crews, activePlan] = await Promise.all([
    supabase.from('profiles').select('name, avatar_url, timezone, streak_freezes_available').eq('id', userId).single(),
    supabase.rpc('get_my_app_prefs'),
    supabase.rpc('get_profile', { target: userId }),
    supabase.from('group_members').select('group_id, joined_at, groups!inner(id, name, emoji, ended_at)').eq('user_id', userId).is('groups.ended_at', null).order('joined_at', { ascending: false }),
    supabase.from('user_plans').select('current_week, plans!inner(slug, name, weeks, cover_url)').eq('user_id', userId).eq('status', 'active').maybeSingle(),
  ]);
  for (const result of [identity, prefs, relation, crews, activePlan]) if (result.error) throw new Error('Could not load profile');
  const p = identity.data;
  if (!p) throw new Error('Profile not found');
  const preferences = prefs.data?.[0];
  if (!relation.data) throw new Error('Profile not found');
  const { completeFollowProfile } = await import('./follows.server');
  const fullProfile = await completeFollowProfile(relation.data as unknown as import('./follows.server').FollowProfile, userId);
  const plan = activePlan.data?.plans;
  return {
    id: userId, name: p.name, username: preferences?.username ?? null, bio: preferences?.bio ?? null,
    isPrivate: preferences?.is_private ?? true,
    avatarUrl: fullProfile.avatar,
    followers: fullProfile.follower_count, following: fullProfile.following_count,
    streak: fullProfile.current_streak ?? 0, badges: fullProfile.badge_count ?? 0, freezes: p.streak_freezes_available,
    crews: (crews.data ?? []).map(row => ({ id: row.group_id, name: row.groups.name, emoji: row.groups.emoji })),
    plan: plan ? { slug: plan.slug, name: plan.name, weeks: plan.weeks, week: activePlan.data?.current_week ?? 1, coverUrl: plan.cover_url } : null,
  };
});

export const checkProfileUsername = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator(input => usernameSchema.parse(input)).handler(async ({ data, context }) => {
    const { data: available, error } = await context.supabase.rpc('is_profile_username_available', { candidate: data });
    if (error) throw new Error('Could not check username');
    return { available: available === true };
  });

export const saveRedesignProfile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => newProfileEditSchema.parse(input)).handler(async ({ data, context }) => {
    await saveNewProfileFields(context.supabase, context.userId, data);
    return { ok: true };
  });