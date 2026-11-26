import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { signAvatarThumbs } from './media-urls';
import type { SocialPerson } from './profile-social';

export type SocialList = {
  profile: { id: string; name: string; username: string | null; follower_count: number; following_count: number };
  people: SocialPerson[]; total: number; hasMore: boolean;
};

export const getSocialList = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ target: z.string().uuid(), direction: z.enum(['followers', 'following', 'requests']), offset: z.number().int().min(0).default(0), search: z.string().max(100).default('') }).parse(input))
  .handler(async ({ data, context }): Promise<SocialList> => {
    const { data: result, error } = await context.supabase.rpc('get_social_list', { target: data.target, direction: data.direction, page_offset: data.offset, query_text: data.search });
    if (error || !result) throw new Error(error?.message ?? 'Could not load this list');
    const list = result as unknown as Omit<SocialList, 'hasMore'>;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const people = list.people.slice(0, 30);
    const avatars = await signAvatarThumbs(supabaseAdmin, people.map(p => p.avatar));
    return { ...list, hasMore: list.people.length > 30, people: people.map(p => ({ ...p, avatar: p.avatar?.startsWith('https://') ? p.avatar : avatars.get(p.avatar ?? '') ?? null })) };
  });

export type ExtraActivityItem = {
  key: string; kind: 'nudge' | 'crew_request' | 'milestone' | 'pact_restart' | 'reminder';
  actorId: string; actorName: string; avatar: string | null; createdAt: string;
  groupId: string; groupName: string; text: string; canCheckIn: boolean; read: boolean;
};

export const getActivityExtras = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [events, reads, prefs, requests] = await Promise.all([
      context.supabase.rpc('get_redesign_activity_extras'),
      context.supabase.from('notification_reads').select('item_key').eq('user_id', context.userId),
      context.supabase.rpc('get_my_app_prefs'),
      context.supabase.rpc('get_social_list', { target: context.userId, direction: 'requests' }),
    ]);
    for (const result of [events, reads, prefs, requests]) if (result.error) throw new Error('Could not load Activity');
    const items = (events.data ?? []) as unknown as ExtraActivityItem[];
    const requestList = requests.data as unknown as Omit<SocialList, 'hasMore'>;
    const pending = prefs.data?.[0]?.is_private ? requestList.people.slice(0, 2) : [];
    const read = new Set((reads.data ?? []).map(r => r.item_key));
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const avatars = await signAvatarThumbs(supabaseAdmin, [...items.map(i => i.avatar), ...pending.map(p => p.avatar)]);
    const signed = (avatar: string | null) => avatar?.startsWith('https://') ? avatar : avatars.get(avatar ?? '') ?? null;
    return { items: items.map(i => ({ ...i, read: read.has(i.key), avatar: signed(i.avatar) })), pending: pending.map(p => ({ ...p, avatar: signed(p.avatar) })), pendingCount: pending.length ? requestList.total : 0, isPrivate: prefs.data?.[0]?.is_private ?? false, userId: context.userId };
  });