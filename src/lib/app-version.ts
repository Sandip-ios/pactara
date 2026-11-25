// Pure rules for which Pactara (classic or redesign) a member sees.
export type AppVersion = "classic" | "new";

export const VERSION_OVERRIDE_KEY = "pactara-v-override";

/** 'new' only when the rollout flag is on AND the member picked 'new'. */
export function resolveAppVersion(
  enabled: boolean | null | undefined,
  appVersion: string | null | undefined,
  override: AppVersion | null = null,
): AppVersion {
  if (override) return override;
  return enabled === true && appVersion === "new" ? "new" : "classic";
}

/** Preview-only testing switch: ?v=new / ?v=classic on id-preview hosts. */
export function previewOverrideAllowed(hostname: string): boolean {
  return hostname.includes("id-preview") || hostname === "localhost" || hostname === "127.0.0.1";
}

export function parseVersionParam(search: string): AppVersion | null {
  const v = new URLSearchParams(search).get("v");
  return v === "new" || v === "classic" ? v : null;
}
