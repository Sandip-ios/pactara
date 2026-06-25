// Browser-side helpers for Web Push subscription.
// Registration is guarded so it never runs in the Lovable preview iframe.

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}


function isPreviewContext(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com")
  );
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export type PushEnableResult =
  | { ok: true; subscription: PushSubscriptionJSON }
  | { ok: false; reason: "unsupported" | "preview" | "denied" | "no-key" | "error"; message?: string };

export async function enablePush(vapidPublicKey: string): Promise<PushEnableResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (isPreviewContext()) return { ok: false, reason: "preview" };
  if (!vapidPublicKey) return { ok: false, reason: "no-key" };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }
    return { ok: true, subscription: sub.toJSON() };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function disablePush(): Promise<PushSubscriptionJSON | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return null;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return null;
    const json = sub.toJSON();
    await sub.unsubscribe();
    return json;
  } catch {
    return null;
  }
}

export function previewBlocked(): boolean {
  return isPreviewContext();
}
