import { followNotificationText, followProfileStats, type FollowActivity } from './follow-profile';
import { signAvatarThumbs } from './media-urls';

export type FollowProfile = {
  id: string; name: string; username: string | null; bio: string | null;
  avatar: string | null; follower_count: number; following_count: number;
  is_private: boolean; can_follow: boolean; relationship: 'none' | 'requested' | 'following' | 'follows_you' | 'blocked';
  shares_crew?: boolean; current_streak?: number; badge_count?: number;
};

export async function completeFollowProfile(profile: FollowProfile, viewerId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const avatars = await signAvatarThumbs(supabaseAdmin, [profile.avatar]);
  const result = { ...profile, avatar: profile.avatar?.startsWith('https://') ? profile.avatar : avatars.get(profile.avatar ?? '') ?? null };
  if (typeof profile.shares_crew !== 'boolean') return result;
  const { data, error } = await supabaseAdmin.rpc('get_visible_follow_profile_stats', { target: profile.id, viewer: viewerId });
  if (error) throw new Error('Could not load profile stats');
  if (!data) {
    // Visibility changed while this request was running. Do not return stats.
    const { shares_crew: _shared, ...limited } = result;
    return limited;
  }
  return { ...result, ...followProfileStats(data as unknown as FollowActivity) };
}

// Same dispatch pattern as crew join requests. Durable in-app events are
// written in the RPC transaction; server actions claim push delivery once.
export async function dispatchFollowPushes(actorId: string) {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: events, error } = await supabaseAdmin.rpc('claim_follow_pushes', { actor: actorId });
    if (error) throw error;
    const { data: actor } = await supabaseAdmin.from('profiles').select('name').eq('id', actorId).maybeSingle();
    const { notifyUsers } = await import('./notify.server');
    for (const event of events ?? []) {
      await notifyUsers([event.recipient_id], {
        title: 'Pactara', body: followNotificationText(actor?.name ?? '', event.kind as 'follow' | 'follow_request' | 'follow_accepted'),
        url: `/u/${actorId}`, actorUserId: actorId,
      }, 'group_activity_enabled');
    }
  } catch (error) {
    console.warn('[follows] push delivery failed', error instanceof Error ? error.message : 'Unknown error');
  }
}