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
  key: string; kind: 'nudge' | 'crew_request' | 'crew_approved' | 'milestone' | 'pact_restart' | 'reminder' | 'plan_invite';
  actorId: string; actorName: string; avatar: string | null; createdAt: string;
  groupId: string; groupName: string; text: string; canCheckIn: boolean; read: boolean; targetId?: string | null;
};

export const getActivityExtras = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [events, reads, prefs, requests, approved] = await Promise.all([
      context.supabase.rpc('get_redesign_activity_extras'),
      context.supabase.from('notification_reads').select('item_key').eq('user_id', context.userId),
      context.supabase.rpc('get_my_app_prefs'),
      context.supabase.rpc('get_social_list', { target: context.userId, direction: 'requests' }),
      context.supabase.from('crew_join_requests').select('id,group_id,decided_at,decided_by')
        .eq('requester_id', context.userId).eq('status', 'approved')
        .gte('decided_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('decided_at', { ascending: false }).limit(100),
    ]);
    for (const result of [events, reads, prefs, requests, approved]) if (result.error) throw new Error('Could not load Activity');
    const items = (events.data ?? []) as unknown as ExtraActivityItem[];
    const approvedGroupIds = [...new Set((approved.data ?? []).map(row => row.group_id))];
    const { data: approvedGroups, error: approvedGroupsError } = approvedGroupIds.length
      ? await context.supabase.from('groups').select('id,name').in('id', approvedGroupIds).is('ended_at', null)
      : { data: [], error: null };
    if (approvedGroupsError) throw new Error('Could not load Activity');
    const approvedGroupName = new Map(approvedGroups.map(group => [group.id, group.name]));
    const approvedItems = await Promise.all((approved.data ?? []).map(async row => {
      if (!row.decided_by || !row.decided_at) return null;
      const { data: person, error } = await context.supabase.rpc('get_profile', { target: row.decided_by });
      const profile = person as { name?: string; avatar?: string | null; relationship?: string } | null;
      if (error || !profile || profile.relationship === 'blocked') return null;
      const groupName = approvedGroupName.get(row.group_id);
      if (!groupName) return null;
      return {
        key: `crew_approved:${row.id}`, kind: 'crew_approved' as const, actorId: row.decided_by,
        actorName: profile.name?.trim() || 'Someone', avatar: profile.avatar ?? null, createdAt: row.decided_at,
        groupId: row.group_id, groupName, text: `You're in ${groupName}.`,
        canCheckIn: false, read: false, targetId: row.id,
      };
    }));
    items.push(...approvedItems.filter(item => item !== null));
    const { planInviteItems } = await import('./profile-social.server');
    items.push(...await planInviteItems(context.supabase, context.userId));
    const requestList = requests.data as unknown as Omit<SocialList, 'hasMore'>;
    const pending = prefs.data?.[0]?.is_private ? requestList.people.slice(0, 2) : [];
    const read = new Set((reads.data ?? []).map(r => r.item_key));
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const avatars = await signAvatarThumbs(supabaseAdmin, [...items.map(i => i.avatar), ...pending.map(p => p.avatar)]);
    const signed = (avatar: string | null) => avatar?.startsWith('https://') ? avatar : avatars.get(avatar ?? '') ?? null;
    return { items: items.map(i => ({ ...i, targetId: i.kind === 'crew_request' || i.kind === 'crew_approved' || i.kind === 'plan_invite' ? (i.targetId ?? i.key.split(':')[1] ?? null) : null, read: read.has(i.key), avatar: signed(i.avatar) })), pending: pending.map(p => ({ ...p, avatar: signed(p.avatar) })), pendingCount: pending.length ? requestList.total : 0, isPrivate: prefs.data?.[0]?.is_private ?? false, userId: context.userId };
  });