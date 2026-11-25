import type { SupabaseClient } from '@supabase/supabase-js';
import type { SafetyReport } from './safety-rules';
import { canInteract } from './safety-rules';

/** A single bidirectional lookup; the RPC only permits self or service-role callers. */
export async function blockedPairs(db: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data, error } = await db.rpc('safety_blocked_pairs', { _user_id: userId });
  if (error) throw new Error('Could not load privacy settings');
  return new Set(((data ?? []) as { user_id: string }[]).map(row => row.user_id));
}

export async function requireInteraction(db: SupabaseClient, userId: string, table: 'daily_posts' | 'post_comments', id: string) {
  const { data, error } = await db.from(table).select('user_id').eq('id', id).maybeSingle();
  if (error || !data || !canInteract(userId, data.user_id as string, await blockedPairs(db, userId))) throw new Error('Interaction not allowed');
}

export async function submitReport(db: SupabaseClient, data: SafetyReport) {
  // Postgres accepts NULL for the user target; generated RPC argument types
  // do not represent nullable parameters, so use the generic client boundary.
  const { error } = await db.rpc('submit_content_report', {
    _reported: data.reportedUserId, _type: data.targetType, _target: data.targetId,
    _group: data.groupId, _reason: data.reason, _details: data.details, _block: data.alsoBlock,
  });
  if (error) throw new Error('Could not send report. Please try again.');
}