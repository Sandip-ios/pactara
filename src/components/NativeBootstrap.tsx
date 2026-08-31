import { useEffect } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { useNavigate } from "@tanstack/react-router";
import { isNative, nativePlatform } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";
import { saveFcmToken } from "@/lib/push.functions";
import { configureRevenueCat, logInRevenueCat, logOutRevenueCat } from "@/lib/revenuecat";
import { getPendingInvite, parseInviteUrl, setPendingInvite, wasInviteConsumed } from "@/lib/pending-invite";
import { getLaunchInviteGroupId } from "@/lib/native-launch";
import { claimDeferredInvite } from "@/lib/deferred-invite";



/**
 * Runs inside the Capacitor shell. Configures native UI and registers this
 * device for push notifications after the user is signed in. Safe no-op on web.
 */
export function NativeBootstrap() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    let registering = false;
    const listenerHandles: Array<Promise<PluginListenerHandle>> = [];

    const platform = nativePlatform() === "android" ? "android" : "ios";

    const openIncomingUrl = (value: string): boolean => {
      const groupId = parseInviteUrl(value);
      if (!groupId || cancelled) return false;

      // Keep the invite pending until the user actually joins. Marking it as
      // consumed here made a failed cold-start navigation impossible to retry.
      setPendingInvite(groupId);
      void navigate({ to: "/join/$groupId", params: { groupId }, replace: true });
      return true;
    };

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
      // Register deep-link handling before any slower native setup. appUrlOpen
      // covers links received while the app is running; getLaunchUrl recovers
      // the link that launched a fully closed app before React was ready.
      try {
        const { App } = await import("@capacitor/app");
        listenerHandles.push(
          App.addListener("appUrlOpen", (event) => {
            openIncomingUrl(event.url);
          }),
        );
        const launchGroupId = await getLaunchInviteGroupId();
        if (launchGroupId) {
          setPendingInvite(launchGroupId);
          void navigate({ to: "/join/$groupId", params: { groupId: launchGroupId }, replace: true });
        }
      } catch (err) {
        console.warn("[deeplink] native URL handling failed", err);
      }

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

      // Deferred deep link: the user tapped an invite in mobile Safari and got
      // sent to the App Store (whether or not the app was already installed).
      // On every cold launch we look for a stashed invite id, and otherwise
      // peek at the clipboard (the invite URL was copied before the redirect).
      // Invites we've already opened are remembered so we never loop.
      try {
        const path = typeof window !== "undefined" ? window.location.pathname : "";
        if (!path.startsWith("/join/")) {
          let pending = getPendingInvite();
          if (!pending) {
            // Deferred deep link: the invite was opened in mobile Safari on
            // this same network before the install, so the server can hand it
            // back without the user tapping the link again.
            try {
              const claimed = await claimDeferredInvite();
              if (claimed && !wasInviteConsumed(claimed)) {
                pending = claimed;
                setPendingInvite(claimed);
              }
            } catch {
              // network unavailable
            }
          }
          // Only peek at the clipboard once, on the very first launch after a
          // fresh install — otherwise iOS shows a "Paste" prompt every launch.
          const CLIPBOARD_PEEK_KEY = "pactara.invite.clipboardPeeked";
          const alreadyPeeked =
            typeof localStorage !== "undefined" && localStorage.getItem(CLIPBOARD_PEEK_KEY) === "1";
          if (!pending && !alreadyPeeked) {
            try {
              localStorage.setItem(CLIPBOARD_PEEK_KEY, "1");
            } catch {
              // storage unavailable
            }
            try {
              const text = await navigator.clipboard?.readText();
              const fromClipboard = text ? parseInviteUrl(text) : null;
              if (fromClipboard && !wasInviteConsumed(fromClipboard)) {
                pending = fromClipboard;
              }
            } catch {
              // clipboard denied
            }
          }

          if (pending && !cancelled) {
            void navigate({ to: "/join/$groupId", params: { groupId: pending }, replace: true });
            return;
          }
        }
      } catch {
        // ignore
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
  }, [navigate]);

  return null;
}
