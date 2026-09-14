// App-icon badge control on the device itself.
//
// Relying on a silent APNs push to reset the badge is unreliable (iOS drops
// background pushes freely), so the app sets its own badge locally whenever it
// learns the true unread count, and clears delivered notifications with it.

import { isNative } from "@/lib/native";
import {
  markGroupNotificationsRead,
  syncBadgeCount,
  type NotificationKind,
} from "@/lib/notifications.functions";

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

/**
 * Recompute the badge from what is genuinely still unread and mirror it on the
 * icon. This is the only source of truth, so the badge can never get stuck.
 */
export async function syncAppBadge(): Promise<void> {
  try {
    const res = await syncBadgeCount({ data: {} });
    await setAppBadge(res?.count ?? 0);
  } catch {
    // best effort
  }
}

/**
 * Called when the user actually opens the items that caused the badge: marks
 * those notifications read server-side, then re-syncs the icon.
 */
export async function markReadAndSyncBadge(input: {
  groupId: string;
  kinds?: NotificationKind[];
  postId?: string | null;
}): Promise<void> {
  try {
    const res = await markGroupNotificationsRead({ data: input });
    await setAppBadge(res?.count ?? 0);
  } catch {
    // best effort
  }
}
