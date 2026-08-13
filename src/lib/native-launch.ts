import { isNative } from "@/lib/native";
import { parseInviteUrl } from "@/lib/pending-invite";

let launchInvitePromise: Promise<string | null> | null = null;

/** Reads Capacitor's one-shot cold-start URL once and shares the result. */
export function getLaunchInviteGroupId(): Promise<string | null> {
  if (launchInvitePromise) return launchInvitePromise;

  launchInvitePromise = (async () => {
    if (!isNative()) return null;
    try {
      const { App } = await import("@capacitor/app");
      const launch = await App.getLaunchUrl();
      return launch?.url ? parseInviteUrl(launch.url) : null;
    } catch (error) {
      console.warn("[deeplink] cold-start URL check failed", error);
      return null;
    }
  })();

  return launchInvitePromise;
}