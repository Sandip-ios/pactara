import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/** RLS and the new-only RPC keep this addition at zero for classic accounts. */
export async function additionalActivityUnread(supabase: SupabaseClient<Database>, read: Set<string>) {
  const [extras, follows] = await Promise.all([
    supabase.rpc('get_redesign_activity_extras'),
    supabase.from('follow_notifications').select('id').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(200),
  ]);
  if (extras.error || follows.error) throw new Error('Could not count Activity');
  const keys = new Set([...(extras.data as unknown as { key: string }[]).map(i => i.key), ...(follows.data ?? []).map(i => `follow:${i.id}`)]);
  return [...keys].filter(key => !read.has(key)).length;
}