import { Capacitor } from "@capacitor/core";

/**
 * Small helpers that let the same web codebase behave correctly both in a
 * browser and inside the native iOS/Android Capacitor shell. All calls are
 * safe to invoke from web contexts — they no-op when not running natively.
 */

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function nativePlatform(): "ios" | "android" | "web" {
  try {
    const p = Capacitor.getPlatform();
    if (p === "ios" || p === "android") return p;
    return "web";
  } catch {
    return "web";
  }
}

/** Light haptic tap. No-op on web. */
export async function hapticLight() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // ignore
  }
}

/** Medium haptic tap (used on primary confirmations). No-op on web. */
export async function hapticMedium() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // ignore
  }
}

/**
 * Share via the native OS sheet when running in the app, otherwise fall
 * back to the Web Share API and finally to clipboard.
 */
export async function shareNativeOrWeb(payload: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<"native" | "web" | "clipboard" | "cancelled"> {
  if (isNative()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return "native";
    } catch {
      return "cancelled";
    }
  }

  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await (
        navigator as Navigator & {
          share: (data: ShareData) => Promise<void>;
        }
      ).share(payload);
      return "web";
    } catch {
      return "cancelled";
    }
  }

  if (
    typeof navigator !== "undefined" &&
    payload.url
  ) {
    const nav = navigator as Navigator & { clipboard?: { writeText: (s: string) => Promise<void> } };
    if (nav.clipboard) {
      try {
        await nav.clipboard.writeText(payload.url);
        return "clipboard";
      } catch {
        return "cancelled";
      }
    }
  }
  return "cancelled";
}
