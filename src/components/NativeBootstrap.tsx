import { useEffect } from "react";
import { isNative, nativePlatform } from "@/lib/native";

/**
 * Runs once on mount inside the Capacitor shell. Configures the status bar,
 * hides the native splash, and registers for push notifications (best-effort).
 * Safe no-op on web.
 */
export function NativeBootstrap() {
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // Dark icons/text on our light cream background
        await StatusBar.setStyle({ style: Style.Dark });
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

      try {
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );
        const perm = await PushNotifications.checkPermissions();
        let granted = perm.receive === "granted";
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          const req = await PushNotifications.requestPermissions();
          granted = req.receive === "granted";
        }
        if (granted && !cancelled) {
          await PushNotifications.register();
          PushNotifications.addListener("registration", (token) => {
            // Backend APNs delivery is not wired yet — see IOS.md.
            // For now we log the token so it can be captured during device testing.
            console.log("[push] APNs token:", token.value);
          });
          PushNotifications.addListener("registrationError", (err) => {
            console.warn("[push] registration error", err);
          });
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
