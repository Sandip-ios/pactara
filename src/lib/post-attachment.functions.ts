import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
const input = z.object({ postId: z.string().uuid(), kind: z.enum(['workout','meal']) });
export const getPostAttachmentSaved = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(data => input.parse(data)).handler(async ({context,data}) => {
  const { data: rows, error } = await context.supabase.from(data.kind === 'workout' ? 'workouts' : 'meals').select('id').eq('user_id',context.userId).eq('source_post_id',data.postId).limit(1);
  if (error) throw new Error('Could not load saved items');
  return !!rows?.length;
});
export const togglePostAttachment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(data => input.extend({ on: z.boolean() }).parse(data)).handler(async ({context,data}) => {
  const { data: id, error } = await context.supabase.rpc('toggle_post_attachment',{ _post_id:data.postId,_kind:data.kind,_on:data.on });
  if (error) throw new Error('Could not save. Try again.');
  return { added: !!id };
});
