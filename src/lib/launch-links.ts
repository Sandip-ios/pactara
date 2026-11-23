import { isNative } from "@/lib/native";
import { toAppPath } from "@/lib/launch-route";

/**
 * Notification taps. The native plugin keeps a cold-start tap until someone
 * listens, so the launch registers the listener first thing and waits a
 * moment for it; the tapped screen then becomes the launch destination.
 * Later taps (app already running) navigate in place — no page reload.
 */
let listening: Promise<void> | null = null;
let launchDeciding = false;
let decided = false;
let pending: string | null = null;
let go: ((href: string) => void) | null = null;

/** How long to wait for a retained cold-start tap after the listener is in. */
const TAP_GRACE_MS = 250;

// The link the launch already opened: iOS also replays it as an "opened
// URL" event once the app is listening, which must not open it a second time.
let launchLink: { path: string; at: number } | null = null;
export function noteLaunchLink(path: string) {
  launchLink = { path, at: Date.now() };
}

function deliver(path: string) {
  if (launchLink && launchLink.path === path && Date.now() - launchLink.at < 15_000) {
    launchLink = null;
    return;
  }
  if (!decided || !go) {
    pending = path;
    return;
  }
  go(path);
}

/** Any incoming in-app link (notification tap or opened URL). */
export function openAppLink(value: string | null | undefined): boolean {
  const path = toAppPath(value);
  if (!path) return false;
  deliver(path);
  return true;
}

export function listenForNotificationTaps(): Promise<void> {
  if (listening) return listening;
  listening = (async () => {
    if (!isNative()) return;
    try {
      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
      await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
        const url = (event?.notification?.data as { url?: string } | undefined)?.url;
        openAppLink(url);
      });
      await new Promise((r) => setTimeout(r, TAP_GRACE_MS));
    } catch (err) {
      console.warn("[push] notification tap listener failed", err);
    }
  })();
  return listening;
}

/** The launch asks for the tapped screen (if any) before picking its destination. */
export async function takeLaunchLink(): Promise<string | null> {
  launchDeciding = true;
  await listenForNotificationTaps();
  const p = pending;
  pending = null;
  decided = true;
  launchDeciding = false;
  return p;
}

/** Wire in the router; also ends the launch window when the app opened elsewhere. */
export function setAppLinkNavigator(fn: (href: string) => void) {
  go = fn;
  if (!launchDeciding) decided = true;
  void listenForNotificationTaps();
  if (decided && pending) {
    const p = pending;
    pending = null;
    fn(p);
  }
}
