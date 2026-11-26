import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { getOwnRedesignProfile } from '@/lib/redesign-profile.functions';
import { stabilizeSignedUrls } from '@/lib/stable-urls';
import { supabase } from '@/integrations/supabase/client';
import { APP_PREFS_KEY } from '@/hooks/use-app-version';
import { type AppVersion, parseVersionParam, previewOverrideAllowed, resolveAppVersion, VERSION_OVERRIDE_KEY } from '@/lib/app-version';

export const ownNewProfileOptions = queryOptions({ queryKey: ['new-own-profile'], queryFn: () => getOwnRedesignProfile().then(stabilizeSignedUrls), staleTime: 30_000 });

/** Runs only under the authenticated, browser-only layout. */
export async function isNewProfileVisit(qc: QueryClient) {
  const prefs = await qc.ensureQueryData(queryOptions({ queryKey: APP_PREFS_KEY, queryFn: async () => {
    const { data, error } = await supabase.rpc('get_my_app_prefs');
    if (error) throw error;
    return data?.[0] ?? null;
  }, staleTime: 5 * 60_000 }));
  let override: AppVersion | null = null;
  if (typeof window !== 'undefined' && previewOverrideAllowed(window.location.hostname)) {
    override = parseVersionParam(window.location.search);
    if (!override) {
      try { const saved = sessionStorage.getItem(VERSION_OVERRIDE_KEY); override = saved === 'new' || saved === 'classic' ? saved : null; } catch { /* preview choice unavailable */ }
    }
  }
  return resolveAppVersion(prefs?.new_version_enabled, prefs?.app_version as AppVersion | null | undefined, override) === 'new';
}