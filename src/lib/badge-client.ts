// App-icon badge control on the device itself.
//
// Relying on a silent APNs push to reset the badge is unreliable (iOS drops
// background pushes freely), so the app sets its own badge locally whenever it
// learns the true unread count, and clears delivered notifications with it.

import { isNative } from "@/lib/native";
import { clearBadgeCount, getBadgeCount } from "@/lib/push.functions";

export async function setAppBadge(count: number): Promise<void> {
  const value = Math.max(0, Math.floor(count));

  if (isNative()) {
    try {
      const { Badge } = await import("@capawesome/capacitor-badge");
      if (value > 0) await Badge.set({ count: value });
      else await Badge.clear();
    } catch (err) {
      console.warn("[badge] native set failed", err);
    }
    if (value === 0) {
      try {
        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
        await FirebaseMessaging.removeAllDeliveredNotifications();
      } catch {
        // best effort
      }
    }
    return;
  }

  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (value > 0) await nav.setAppBadge?.(value);
    else await nav.clearAppBadge?.();
  } catch {
    // best effort
  }
}

/** Pull the authoritative count from the server and mirror it on the icon. */
export async function syncAppBadge(): Promise<void> {
  try {
    const res = await getBadgeCount();
    await setAppBadge(res?.count ?? 0);
  } catch {
    // best effort
  }
}

/** Called when the user actually opens the items that caused the badge. */
export async function clearBadge(by?: number): Promise<void> {
  try {
    const res = await clearBadgeCount({ data: by ? { by } : {} });
    await setAppBadge(res?.count ?? 0);
  } catch {
    // best effort
  }
}
