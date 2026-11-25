import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type AppVersion,
  VERSION_OVERRIDE_KEY,
  parseVersionParam,
  previewOverrideAllowed,
  resolveAppVersion,
} from "@/lib/app-version";

export const APP_PREFS_KEY = ["app-prefs"] as const;

export function useAppPrefs() {
  return useQuery({
    queryKey: APP_PREFS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_app_prefs");
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) ?? null;
    },
    staleTime: 5 * 60_000,
  });
}

function readOverride(): AppVersion | null {
  if (typeof window === "undefined" || !previewOverrideAllowed(window.location.hostname)) return null;
  const fromUrl = parseVersionParam(window.location.search);
  try {
    if (fromUrl) sessionStorage.setItem(VERSION_OVERRIDE_KEY, fromUrl);
    const stored = sessionStorage.getItem(VERSION_OVERRIDE_KEY);
    return stored === "new" || stored === "classic" ? stored : null;
  } catch {
    return fromUrl;
  }
}

export function clearVersionOverride() {
  try { sessionStorage.removeItem(VERSION_OVERRIDE_KEY); } catch { /* ignore */ }
}

/** 'classic' until prefs load, so classic members never see a flash of the new app. */
export function useAppVersion(): AppVersion {
  const { data } = useAppPrefs();
  const [override, setOverride] = useState<AppVersion | null>(null);
  useEffect(() => { setOverride(readOverride()); }, []);
  return resolveAppVersion(data?.new_version_enabled, data?.app_version, override);
}

export function useSetAppVersion() {
  const qc = useQueryClient();
  return async (version: AppVersion) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");
    const { error } = await supabase.from("profiles").update({ app_version: version }).eq("id", auth.user.id);
    if (error) throw error;
    clearVersionOverride();
    await qc.invalidateQueries({ queryKey: APP_PREFS_KEY });
  };
}
