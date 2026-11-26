import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { followNotificationText, type FollowNotificationKind } from './follow-profile';
import { signAvatarThumbs } from './media-urls';

const targetInput = z.object({ target: z.string().uuid() });

export const followUser = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => targetInput.parse(input)).handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('follow_user', data);
    if (error) throw new Error(error.message);
    const { dispatchFollowPushes } = await import('./follows.server');
    await dispatchFollowPushes(context.userId);
    return result;
  });

export const unfollowUser = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => targetInput.parse(input)).handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('unfollow_user', data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const respondFollowRequest = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ follower: z.string().uuid(), accept: z.boolean() }).parse(input)).handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('respond_follow_request', data);
    if (error) throw new Error(error.message);
    const { dispatchFollowPushes } = await import('./follows.server');
    await dispatchFollowPushes(context.userId);
    return result;
  });

export const removeFollower = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ follower: z.string().uuid() }).parse(input)).handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('remove_follower', data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setProfilePrivacy = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ private: z.boolean() }).parse(input)).handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('set_profile_privacy', data);
    if (error) throw new Error(error.message);
    const { dispatchFollowPushes } = await import('./follows.server');
    await dispatchFollowPushes(context.userId);
    const { data: prefs, error: prefsError } = await context.supabase.rpc('get_my_app_prefs');
    if (prefsError) throw new Error(prefsError.message);
    return { isPrivate: prefs?.[0]?.is_private ?? true };
  });

// The DB get_profile RPC returns safe identity/relationship fields. This
// authenticated read adds the existing local-date streak logic server-side.
export const get_profile = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ target: z.string().trim().min(1).max(50) }).parse(input)).handler(async ({ data, context }) => {
    const { data: profile, error } = await context.supabase.rpc('get_profile', data);
    if (error) throw new Error(error.message);
    if (!profile) return null;
    const { completeFollowProfile } = await import('./follows.server');
    return completeFollowProfile(profile as unknown as import('./follows.server').FollowProfile, context.userId);
  });

export const getFollowProfile = get_profile;

export const listProfileFollows = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ target: z.string().uuid(), direction: z.enum(['followers', 'following']), page_size: z.number().int().min(1).max(100).default(50), page_offset: z.number().int().min(0).default(0) }).parse(input)).handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc('list_profile_follows', data);
    if (error) throw new Error(error.message);
    // Rows are already visibility-filtered. Signing uses the service client
    // because approved followers need not share a crew with the photo owner.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const avatars = await signAvatarThumbs(supabaseAdmin, (rows ?? []).map(row => row.avatar));
    return (rows ?? []).map(row => ({ ...row, avatar: row.avatar?.startsWith('https://') ? row.avatar : avatars.get(row.avatar ?? '') ?? null }));
  });

// New-only addition to the existing activity notifications, sharing the
// notification_reads keys and markNotificationsRead action. Classic callers
// keep using getNotifications and its count unchanged.
export const getFollowNotifications = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase.from('follow_notifications').select('id,actor_id,kind,created_at').order('created_at', { ascending: false }).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).limit(200);
    if (error) throw new Error(error.message);
    const items = await Promise.all((rows ?? []).map(async row => {
      const { data: profile, error: profileError } = await context.supabase.rpc('get_profile', { target: row.actor_id });
      if (profileError) throw new Error(profileError.message);
      const person = profile as { name?: string; avatar?: string | null; relationship?: string; can_follow?: boolean } | null;
      if (!person || person.relationship === 'blocked') return null;
      return { key: `follow:${row.id}`, kind: row.kind, actorId: row.actor_id, actorName: person.name ?? 'Someone', text: followNotificationText(person.name ?? '', row.kind as FollowNotificationKind), createdAt: row.created_at, avatar: person.avatar ?? null, relationship: person.relationship ?? 'none', canFollow: person.can_follow ?? false };
    }));
    const { data: reads, error: readError } = await context.supabase.from('notification_reads').select('item_key').eq('user_id', context.userId);
    if (readError) throw new Error(readError.message);
    const read = new Set((reads ?? []).map(row => row.item_key));
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const avatars = await signAvatarThumbs(supabaseAdmin, items.map(item => item?.avatar));
    const visible = items.filter(item => item !== null).map(item => ({ ...item, read: read.has(item.key), avatar: item.avatar?.startsWith('https://') ? item.avatar : avatars.get(item.avatar ?? '') ?? null }));
    return { items: visible, unread: visible.filter(item => !item.read).length };
  });
/** Account privacy screen: current setting, under-18 lock and pending request count. */
export const getPrivacySettings = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [prefs, requests] = await Promise.all([
      context.supabase.rpc('get_my_app_prefs'),
      context.supabase.rpc('get_social_list', { target: context.userId, direction: 'requests' }),
    ]);
    if (prefs.error || requests.error) throw new Error('Could not load privacy settings');
    const { isUnder18 } = await import('./redesign-profile');
    const p = prefs.data?.[0];
    return { isPrivate: p?.is_private ?? true, isTeen: isUnder18(p?.birthday ?? null), pending: (requests.data as unknown as { total?: number })?.total ?? 0 };
  });
