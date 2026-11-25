import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { profileEditSchema, saveProfileFields } from './profile-view';

export const saveEditedProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(profileEditSchema)
  .handler(async ({ data, context }) => {
    await saveProfileFields(context.supabase, context.userId, data);
    return { ok: true };
  });