import { isNative, nativePlatform } from "@/lib/native";

const ORIGIN = "https://pactara.lovable.app";

/**
 * Web side: remember this invite server-side (hashed IP + platform) right
 * before the visitor is sent to the App Store, so a fresh install can pick it
 * up without them tapping the link again.
 */
export async function recordDeferredInvite(groupId: string): Promise<void> {
  try {
    await fetch("/api/public/invite/defer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
      keepalive: true,
    });
  } catch {
    // best effort
  }
}

/**
 * Native side: on a cold launch, ask the server whether an invite was opened
 * from this device's network shortly before install.
 */
export async function claimDeferredInvite(): Promise<string | null> {
  if (!isNative()) return null;
  const platform = nativePlatform() === "android" ? "android" : "ios";
  try {
    const res = await fetch(`${ORIGIN}/api/public/invite/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { groupId?: string | null };
    return json.groupId ?? null;
  } catch {
    return null;
  }
}
