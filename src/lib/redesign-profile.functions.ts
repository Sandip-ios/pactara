import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
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
/** Someone else's profile for the new version: get_profile plus shared crews, follows-me and "Followed by". */
export const getRedesignMemberProfile = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ target: z.string().trim().min(1).max(50) }).parse(input)).handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: raw, error } = await supabase.rpc('get_profile', { target: data.target });
    if (error) throw new Error('Could not load profile');
    if (!raw) return null;
    const base = raw as unknown as import('./follows.server').FollowProfile;
    if (base.id === userId) return { isSelf: true as const, id: userId };
    if (base.relationship === 'blocked') {
      // Only your own block is ever revealed; their block reads as an unavailable account.
      const { data: mine } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId).eq('blocked_id', base.id).maybeSingle();
      if (!mine) return null;
      return { isSelf: false as const, blocked: true as const, id: base.id, username: base.username, name: base.name, avatarUrl: null as string | null };
    }
    const { completeFollowProfile } = await import('./follows.server');
    const profile = await completeFollowProfile(base, userId);
    const [mine, followsMe, myFollowing, postCount] = await Promise.all([
      supabase.from('group_members').select('group_id, groups!inner(id, name, ended_at)').eq('user_id', userId).is('groups.ended_at', null),
      supabase.from('follows').select('follower_id').eq('follower_id', base.id).eq('following_id', userId).eq('status', 'accepted').maybeSingle(),
      supabase.from('follows').select('following_id').eq('follower_id', userId).eq('status', 'accepted'),
      // RLS decides which of their posts you can see; the count matches the grid.
      supabase.from('social_posts').select('id', { count: 'exact', head: true }).eq('user_id', base.id).eq('status', 'live'),
    ]);
    if (mine.error || followsMe.error || myFollowing.error) throw new Error('Could not load profile');
    const myCrews = (mine.data ?? []).map(row => ({ id: row.group_id, name: row.groups.name }));
    let sharedCrews: { id: string; name: string }[] = [];
    if (myCrews.length) {
      const { data: theirs, error: theirError } = await supabase.from('group_members').select('group_id').eq('user_id', base.id).in('group_id', myCrews.map(c => c.id));
      if (theirError) throw new Error('Could not load profile');
      const ids = new Set((theirs ?? []).map(r => r.group_id));
      sharedCrews = myCrews.filter(c => ids.has(c.id));
    }
    const visible = !profile.is_private || profile.relationship === 'following' || sharedCrews.length > 0;
    let followedBy: { firstName: string; total: number } | null = null;
    const followingIds = (myFollowing.data ?? []).map(r => r.following_id).filter(id => id !== base.id);
    if (visible && followingIds.length) {
      // Follower lists of others are not readable under RLS; only a first name and a count leave the server.
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: mutual, count } = await supabaseAdmin.from('follows').select('follower_id, created_at', { count: 'exact' }).eq('following_id', base.id).eq('status', 'accepted').in('follower_id', followingIds).order('created_at', { ascending: false }).limit(1);
      const first = mutual?.[0]?.follower_id;
      if (first && count) {
        const { data: person } = await supabaseAdmin.from('profiles').select('name, username').eq('id', first).maybeSingle();
        followedBy = { firstName: (person?.name ?? '').trim().split(/\s+/)[0] || person?.username || 'Member', total: count };
      }
    }
    return {
      isSelf: false as const, blocked: false as const, id: base.id, name: profile.name ?? '', username: profile.username, bio: profile.bio,
      avatarUrl: profile.avatar, followers: profile.follower_count, following: profile.following_count,
      isPrivate: profile.is_private, canFollow: profile.can_follow, relationship: profile.relationship,
      followsMe: Boolean(followsMe.data), streak: 'current_streak' in profile ? profile.current_streak ?? null : null,
      sharedCrews, followedBy, posts: postCount.count ?? 0,
    };
  });

/** Own data for the new-version Your progress page. */
export const getRedesignProgress = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabase, userId } = context;
  const { localDateIn } = await import('./streak-rules');
  const { progressStreak, uniqueCheckIns, prsInMonth } = await import('./progress-view');
  const profile = await supabase.from('profiles').select('timezone, streak_freezes_available').eq('id', userId).single();
  if (profile.error) throw new Error('Could not load progress');
  const today = localDateIn(profile.data.timezone || 'UTC');
  const month = today.slice(0, 7);
  const [crews, checkIns, covered, badges, prs] = await Promise.all([
    supabase.from('group_members').select('group_id').eq('user_id', userId),
    supabase.from('check_ins').select('group_id, checkin_date, photo_url, created_at').eq('user_id', userId),
    supabase.from('streak_freezes_used').select('group_id, freeze_date').eq('user_id', userId),
    supabase.from('earned_badges').select('streak_days, earned_at').eq('user_id', userId),
    supabase.from('workout_set_logs').select('session_id, exercise_id, local_date, is_pr').eq('user_id', userId).eq('is_pr', true).gte('local_date', `${month}-01`),
  ]);
  for (const r of [crews, checkIns, covered, badges, prs]) if (r.error) throw new Error('Could not load progress');
  const ci = checkIns.data ?? [], cov = covered.data ?? [];
  const streak = progressStreak((crews.data ?? []).map(c => ({
    dates: ci.filter(r => r.group_id === c.group_id).map(r => r.checkin_date),
    covered: cov.filter(r => r.group_id === c.group_id).map(r => r.freeze_date),
  })), today);
  return {
    today, streak,
    workouts: uniqueCheckIns(ci),
    prsThisMonth: prsInMonth(prs.data ?? [], month),
    workoutDays: [...new Set(ci.map(r => r.checkin_date))],
    restDays: [...new Set(cov.map(r => r.freeze_date))],
    badges: (badges.data ?? []).map(b => ({ days: b.streak_days, earnedAt: b.earned_at })),
    freezes: profile.data.streak_freezes_available ?? 0,
  };
});
