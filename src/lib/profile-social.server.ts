import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/** RLS and the new-only RPC keep this addition at zero for classic accounts. */
export async function additionalActivityUnread(supabase: SupabaseClient<Database>, read: Set<string>) {
  const [extras, follows, invites] = await Promise.all([
    supabase.rpc('get_redesign_activity_extras'),
    supabase.from('follow_notifications').select('id').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(200),
    supabase.from('plan_invite_notifications').select('id').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).limit(100),
  ]);
  if (extras.error || follows.error || invites.error) throw new Error('Could not count Activity');
  const keys = new Set([...(extras.data as unknown as { key: string }[]).map(i => i.key), ...(follows.data ?? []).map(i => `follow:${i.id}`), ...(invites.data ?? []).map(i => `plan_invite:${i.id}`)]);
  return [...keys].filter(key => !read.has(key)).length;
}

/** New-version plan invites as Activity rows (RLS: recipient on the new version only; blocked actors dropped). */
export async function planInviteItems(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.from('plan_invite_notifications')
    .select('id, actor_id, group_id, created_at, plans!inner(name, is_published), groups!inner(name, ended_at)')
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Could not load Activity');
  if (!data?.length) return [];
  const { blockedPairs } = await import('./safety.server');
  const blocked = await blockedPairs(supabase as unknown as SupabaseClient, userId);
  const rows = data.filter(r => !blocked.has(r.actor_id) && (r.plans as unknown as { is_published: boolean }).is_published && !(r.groups as unknown as { ended_at: string | null }).ended_at);
  const { data: people } = rows.length ? await supabase.from('profiles').select('id, name, avatar_url').in('id', [...new Set(rows.map(r => r.actor_id))]) : { data: [] };
  const byId = new Map((people ?? []).map(p => [p.id, p]));
  return rows.map(r => {
    const name = byId.get(r.actor_id)?.name?.trim() || 'Someone';
    return {
      key: `plan_invite:${r.id}`, kind: 'plan_invite' as const, actorId: r.actor_id, actorName: name.split(' ')[0] ?? name,
      avatar: byId.get(r.actor_id)?.avatar_url ?? null, createdAt: r.created_at, groupId: r.group_id, groupName: '',
      text: `started ${(r.plans as unknown as { name: string }).name}. Want to do it together?`, canCheckIn: false, read: false, targetId: r.id,
    };
  });
}
