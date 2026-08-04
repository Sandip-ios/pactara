import { useEffect } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { isNative, nativePlatform } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";
import { saveFcmToken } from "@/lib/push.functions";
import { configureRevenueCat, logInRevenueCat, logOutRevenueCat } from "@/lib/revenuecat";

/**
 * Runs inside the Capacitor shell. Configures native UI and registers this
 * device for push notifications after the user is signed in. Safe no-op on web.
 */
export function NativeBootstrap() {
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    let registering = false;
    const listenerHandles: Array<Promise<PluginListenerHandle>> = [];

    const platform = nativePlatform() === "android" ? "android" : "ios";

    const saveToken = async (token: string) => {
      if (!token || cancelled) return;
      try {
        console.info("[push] saving FCM token", { platform, tokenLength: token.length });
        await saveFcmToken({ data: { token, platform } });
        console.info("[push] FCM token saved");
      } catch (err) {
        console.warn("[push] saveFcmToken failed", err);
      }
    };

    const registerForPush = async () => {
      if (registering || cancelled) return;
      registering = true;
      try {
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session || cancelled) {
          console.info("[push] waiting for signed-in session before FCM registration");
          return;
        }

        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
        console.info("[push] checking Firebase Messaging permission");
        const perm = await FirebaseMessaging.checkPermissions();
        let granted = perm.receive === "granted";
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          console.info("[push] requesting Firebase Messaging permission");
          const req = await FirebaseMessaging.requestPermissions();
          granted = req.receive === "granted";
        }
        if (!granted || cancelled) {
          console.info("[push] notification permission not granted", { receive: perm.receive });
          return;
        }

        console.info("[push] requesting FCM registration token");
        const { token } = await FirebaseMessaging.getToken();
        console.info("[push] received FCM token", { tokenLength: token?.length ?? 0 });
        await saveToken(token);
      } catch (err) {
        console.warn("[push] Firebase Messaging registration failed", err);
      } finally {
        registering = false;
      }
    };

    (async () => {
      try {
        await configureRevenueCat();
      } catch (err) {
        console.warn("[revenuecat] initial configure failed", err);
      }

      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // Style.Light = dark icons/text (for our light cream background)
        await StatusBar.setStyle({ style: Style.Light });
        if (nativePlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: "#FFFFFF" });
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
        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

        // If Firebase issues a fresh token later (reinstall, restore, etc.),
        // upsert the new one so the backend targets the current device.
        listenerHandles.push(
          FirebaseMessaging.addListener("tokenReceived", async (event) => {
            console.info("[push] tokenReceived event", { tokenLength: event?.token?.length ?? 0 });
            if (event?.token) await saveToken(event.token);
          }),
        );

        listenerHandles.push(
          FirebaseMessaging.addListener("apnsTokenReceived", (event) => {
            console.info("[push] APNs token received", { tokenLength: event?.token?.length ?? 0 });
          }),
        );

        listenerHandles.push(
          FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
            const url = (event?.notification?.data as { url?: string } | undefined)?.url;
            if (url && typeof window !== "undefined") {
              window.location.assign(url);
            }
          }),
        );
      } catch (err) {
        console.warn("[push] Firebase Messaging listeners failed", err);
      }

      try {
        // Universal links (e.g. group invites at /join/:groupId) opened while
        // the app is installed should land on that page inside the app.
        const { App } = await import("@capacitor/app");
        listenerHandles.push(
          App.addListener("appUrlOpen", (event) => {
            try {
              const url = new URL(event.url);
              const path = `${url.pathname}${url.search}`;
              if (path && path !== "/" && typeof window !== "undefined") {
                window.location.assign(path);
              }
            } catch {
              // ignore malformed urls
            }
          }),
        );
      } catch (err) {
        console.warn("[deeplink] appUrlOpen listener failed", err);
      }


      await registerForPush();
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        window.setTimeout(() => void registerForPush(), 0);
        window.setTimeout(() => {
          supabase.auth.getUser().then(({ data }) => {
            if (data.user?.id) void logInRevenueCat(data.user.id);
          });
        }, 0);
      }
      if (event === "SIGNED_OUT") {
        window.setTimeout(() => void logOutRevenueCat(), 0);
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      listenerHandles.forEach((handle) => {
        void handle.then((listener) => listener.remove()).catch(() => undefined);
      });
    };
  }, []);

  return null;
}
