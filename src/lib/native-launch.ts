import { isNative } from "@/lib/native";
import { parseInviteUrl } from "@/lib/pending-invite";
import { toAppPath } from "@/lib/launch-route";

let launchUrlPromise: Promise<string | null> | null = null;

/** Capacitor's one-shot cold-start URL, read once and shared. */
function getLaunchUrl(): Promise<string | null> {
  if (launchUrlPromise) return launchUrlPromise;
  launchUrlPromise = (async () => {
    if (!isNative()) return null;
    try {
      const { App } = await import("@capacitor/app");
      const launch = await App.getLaunchUrl();
      return launch?.url ?? null;
    } catch (error) {
      console.warn("[deeplink] cold-start URL check failed", error);
      return null;
    }
  })();
  return launchUrlPromise;
}

/** The invite the app was opened with, if any. */
export async function getLaunchInviteGroupId(): Promise<string | null> {
  const url = await getLaunchUrl();
  return url ? parseInviteUrl(url) : null;
}

/** Any other in-app screen the app was opened with (not an invite). */
export async function getLaunchLinkPath(): Promise<string | null> {
  const url = await getLaunchUrl();
  if (!url || parseInviteUrl(url)) return null;
  return toAppPath(url);
}
