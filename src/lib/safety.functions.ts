import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { reportSchema } from './safety-rules';
import { signAvatarThumbs } from './media-urls';

export const safetyQueryKey = ['safety'] as const;

export const getSafetyState = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { blockedPairs } = await import('./safety.server');
    const [pairs, own] = await Promise.all([
      blockedPairs(context.supabase, context.userId),
      context.supabase.from('user_blocks').select('blocked_id').eq('blocker_id', context.userId),
    ]);
    if (own.error) throw new Error('Could not load privacy settings');
    return { blocked: [...pairs], own: (own.data ?? []).map(r => r.blocked_id) };
  });

export const getBlockedPeople = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: blocks, error } = await context.supabase.from('user_blocks').select('blocked_id, created_at').eq('blocker_id', context.userId).order('created_at', { ascending: false });
    if (error) throw new Error('Could not load blocked people');
    if (!blocks?.length) return [];
    // Profiles may no longer be visible after leaving a shared crew. The server
    // reads only names/photos for IDs verified against this member's own list.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: people, error: peopleError } = await supabaseAdmin.from('profiles').select('id, name, avatar_color, avatar_url').in('id', blocks.map(r => r.blocked_id));
    if (peopleError) throw new Error('Could not load blocked people');
    const urls = await signAvatarThumbs(supabaseAdmin, (people ?? []).map(p => p.avatar_url));
    return blocks.map(block => {
      const p = people?.find(person => person.id === block.blocked_id);
      return { id: block.blocked_id, name: p?.name || 'Member', avatarColor: p?.avatar_color || '', avatarUrl: p?.avatar_url ? urls.get(p.avatar_url) ?? null : null };
    });
  });

export const setUserBlock = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), blocked: z.boolean() }))
  .handler(async ({ context, data }) => {
    if (data.userId === context.userId) throw new Error('You cannot block yourself');
    const result = data.blocked
      ? await context.supabase.from('user_blocks').upsert({ blocker_id: context.userId, blocked_id: data.userId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true })
      : await context.supabase.from('user_blocks').delete().eq('blocker_id', context.userId).eq('blocked_id', data.userId);
    if (result.error) throw new Error('Could not update blocked people');
    return { ok: true };
  });

export const setHiddenPost = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ postId: z.string().uuid(), hidden: z.boolean() }))
  .handler(async ({ context, data }) => {
    const result = data.hidden
      ? await context.supabase.from('hidden_posts').upsert({ user_id: context.userId, post_id: data.postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
      : await context.supabase.from('hidden_posts').delete().eq('user_id', context.userId).eq('post_id', data.postId);
    if (result.error) throw new Error('Could not update hidden posts');
    return { ok: true };
  });

export const sendContentReport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(reportSchema)
  .handler(async ({ context, data }) => {
    const { submitReport } = await import('./safety.server');
    await submitReport(context.supabase, data);
    return { ok: true };
  });