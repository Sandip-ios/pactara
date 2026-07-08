import { useEffect } from "react";
import { isNative, nativePlatform } from "@/lib/native";
import { saveFcmToken } from "@/lib/push.functions";

/**
 * Runs once on mount inside the Capacitor shell. Configures the status bar,
 * hides the native splash, and registers this device for push notifications
 * via Firebase Cloud Messaging. The FCM token is stored server-side so the
 * backend can target this device (iOS via APNs bridged by Firebase, Android
 * via FCM directly). Safe no-op on web.
 */
export function NativeBootstrap() {
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // Style.Light = dark icons/text (for our light cream background)
        await StatusBar.setStyle({ style: Style.Light });
        if (nativePlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: "#F5F2EE" });
        }
      } catch {
        // ignore
      }

      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        // ignore
      }

      // --- Push registration via Firebase Cloud Messaging --------------------
      try {
        const { FirebaseMessaging } = await import(
          "@capacitor-firebase/messaging"
        );

        const perm = await FirebaseMessaging.checkPermissions();
        let granted = perm.receive === "granted";
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          const req = await FirebaseMessaging.requestPermissions();
          granted = req.receive === "granted";
        }
        if (!granted || cancelled) return;

        const { token } = await FirebaseMessaging.getToken();
        if (!token || cancelled) return;

        const platform = nativePlatform() === "android" ? "android" : "ios";
        try {
          await saveFcmToken({ data: { token, platform } });
        } catch (err) {
          console.warn("[push] saveFcmToken failed", err);
        }

        // If Firebase issues a fresh token later (reinstall, restore, etc.),
        // upsert the new one so the backend targets the current device.
        FirebaseMessaging.addListener("tokenReceived", async (event) => {
          if (!event?.token) return;
          try {
            await saveFcmToken({ data: { token: event.token, platform } });
          } catch (err) {
            console.warn("[push] token refresh save failed", err);
          }
        });

        FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
          const url =
            (event?.notification?.data as { url?: string } | undefined)?.url;
          if (url && typeof window !== "undefined") {
            window.location.assign(url);
          }
        });
      } catch (err) {
        console.warn("[push] Firebase Messaging init failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
