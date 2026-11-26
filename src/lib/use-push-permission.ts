import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isNative, nativePlatform } from "@/lib/native";
import { saveFcmToken } from "@/lib/push.functions";
import { previewOverrideAllowed } from "@/lib/app-version";
import { parseNotifParam, type PushPermission } from "@/lib/notif-banner";

const OVERRIDE_KEY = "pactara-notif-override";

/** Preview hosts only: ?notif=denied|default, kept for the browser tab. */
function readOverride(): PushPermission | null {
  if (typeof window === "undefined" || !previewOverrideAllowed(window.location.hostname)) return null;
  try {
    const fromUrl = parseNotifParam(window.location.search);
    if (fromUrl) sessionStorage.setItem(OVERRIDE_KEY, fromUrl);
    const v = sessionStorage.getItem(OVERRIDE_KEY);
    return v === "denied" || v === "prompt" ? v : null;
  } catch { return null; }
}

export function isPreviewNotifOverride(): boolean { return readOverride() != null; }

async function readPermission(): Promise<PushPermission> {
  const o = readOverride();
  if (o) return o;
  if (!isNative()) return "unsupported";
  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    const { receive } = await FirebaseMessaging.checkPermissions();
    return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
  } catch { return "unsupported"; }
}

/** Same registration as NativeBootstrap: FCM token saved for this device. */
async function registerToken() {
  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
  const { token } = await FirebaseMessaging.getToken();
  if (token) await saveFcmToken({ data: { token, platform: nativePlatform() === "android" ? "android" : "ios" } });
}

export const PUSH_PERMISSION_KEY = ["push-permission"] as const;

/** Push permission, re-read whenever the app comes back to the foreground. */
export function usePushPermission() {
  const q = useQuery({ queryKey: PUSH_PERMISSION_KEY, queryFn: readPermission, staleTime: Infinity });
  const { refetch } = q;
  const [native, setNative] = useState(false);
  useEffect(() => { setNative(isNative() || readOverride() != null); }, []);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") void refetch(); };
    document.addEventListener("visibilitychange", onVis);
    let handle: { remove: () => void } | null = null, gone = false;
    if (isNative()) void import("@capacitor/app").then(({ App }) => App.addListener("appStateChange", ({ isActive }) => { if (isActive) void refetch(); })).then((h) => { if (gone) h.remove(); else handle = h; });
    return () => { gone = true; document.removeEventListener("visibilitychange", onVis); handle?.remove(); };
  }, [refetch]);
  useEffect(() => {
    if (q.data === "granted" && isNative()) void registerToken().catch(() => undefined);
  }, [q.data]);

  /** Shows the iOS prompt when never asked; returns the resulting state. */
  const request = useCallback(async (): Promise<PushPermission> => {
    if (readOverride() || !isNative()) return q.data ?? "unsupported";
    try {
      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
      await FirebaseMessaging.requestPermissions();
    } catch { /* fall through to re-read */ }
    return (await refetch()).data ?? "unsupported";
  }, [q.data, refetch]);

  return { permission: q.data ?? null, native, request, recheck: refetch };
}
