import { useEffect, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { useNavigate } from "@tanstack/react-router";
import { focusManager } from "@tanstack/react-query";
import { isNative, nativePlatform } from "@/lib/native";
import { syncAppBadge } from "@/lib/badge-client";
import { supabase } from "@/integrations/supabase/client";
import { saveFcmToken } from "@/lib/push.functions";
import { configureRevenueCat, logInRevenueCat, logOutRevenueCat } from "@/lib/revenuecat";
import { getPendingInvite, parseInviteUrl, setPendingInvite, wasInviteConsumed } from "@/lib/pending-invite";
import { getLaunchInviteGroupId } from "@/lib/native-launch";
import { claimDeferredInvite } from "@/lib/deferred-invite";
import { claimReferralInstall, linkReferralInstall } from "@/lib/referral";
import { trackInvite } from "@/lib/invite-analytics";
import { openAppLink, setAppLinkNavigator } from "@/lib/launch-links";
import { launchScreenUp } from "@/lib/launch-screen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";



/**
 * Runs inside the Capacitor shell. Configures native UI and registers this
 * device for push notifications after the user is signed in. Safe no-op on web.
 */
export function NativeBootstrap() {
  const navigate = useNavigate();
  const [showNotificationSettingsPrompt, setShowNotificationSettingsPrompt] = useState(false);

  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    let registering = false;
    const listenerHandles: Array<Promise<PluginListenerHandle>> = [];

    const platform = nativePlatform() === "android" ? "android" : "ios";

    // Taps and links while the app is running navigate in place (no reload).
    setAppLinkNavigator((href) => {
      if (!cancelled) void navigate({ href });
    });

    const openIncomingUrl = (value: string): boolean => {
      if (cancelled) return false;
      const groupId = parseInviteUrl(value);
      // Any other link into the app opens that screen in place.
      if (!groupId) return openAppLink(value);

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
        let permissionState = perm.receive;
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          console.info("[push] requesting Firebase Messaging permission");
          const req = await FirebaseMessaging.requestPermissions();
          permissionState = req.receive;
        }
        const granted = permissionState === "granted";
        if (!granted || cancelled) {
          console.info("[push] notification permission not granted", { receive: permissionState });
          if (!cancelled && permissionState === "denied") {
            setShowNotificationSettingsPrompt(true);
          }
          return;
        }

        setShowNotificationSettingsPrompt(false);
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
        listenerHandles.push(
          App.addListener("appStateChange", ({ isActive }) => {
            // Native suspension does not reliably emit browser visibility events.
            // Drive Query's focus lifecycle so stale signed photos refresh on return.
            focusManager.setFocused(isActive);
            if (isActive) {
              void registerForPush();
              void syncAppBadge();
            }
          }),
        );
        const launchGroupId = await getLaunchInviteGroupId();
        // The launch normally opened the invite already; only navigate if not.
        if (launchGroupId && !window.location.pathname.startsWith(`/join/${launchGroupId}`)) {
          setPendingInvite(launchGroupId);
          void navigate({ to: "/join/$groupId", params: { groupId: launchGroupId }, replace: true });
        }
      } catch (err) {
        console.warn("[deeplink] native URL handling failed", err);
      }

      void syncAppBadge();

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

      // The native splash is hidden by the launch screen itself (SplashScreen.tsx)
      // once the identical web one is painted; this is only the fallback.
      const hideNativeSplash = async () => {
        try {
          const { SplashScreen } = await import("@capacitor/splash-screen");
          await SplashScreen.hide({ fadeOutDuration: 0 });
        } catch {
          // ignore
        }
      };
      if (!launchScreenUp()) void hideNativeSplash();
      else window.addEventListener("pactara:launch-done", () => void hideNativeSplash(), { once: true });

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

        // Notification taps are handled by launch-links.ts (registered at launch
        // so a cold-start tap opens its screen first, not Home).
      } catch (err) {
        console.warn("[push] Firebase Messaging listeners failed", err);
      }

      // Deferred deep link: the user tapped an invite in mobile Safari and got
      // sent to the App Store (whether or not the app was already installed).
      // On every cold launch we look for a stashed invite id, and otherwise
      // ask the server for an invite opened recently from this device's
      // network. Invites we've already opened are remembered so we never loop.
      // We intentionally do NOT read the clipboard here — iOS shows a "Paste"
      // permission banner when an app accesses UIPasteboard.
      try {
        const path = typeof window !== "undefined" ? window.location.pathname : "";
        // Only replay a stashed invite when the app opened on its default
        // entry screen. Tapping a push notification loads a real destination
        // (/home?post=…, /groups/…, /chat/…) — hijacking that with an old
        // invite sent people to a stale invite screen instead.
        const isEntryPath = path === "" || path === "/" || path === "/index";
        if (isEntryPath) {
          let pending = getPendingInvite();
          if (!pending) {
            // Deferred deep link: the invite was opened in mobile Safari on
            // this same network before the install, so the server can hand it
            // back without the user tapping the link again.
            // Only for a genuine fresh install with no signed-in account —
            // an existing signed-in user must never inherit a network-matched
            // invite they never tapped.
            const { data: auth } = await supabase.auth.getSession();
            if (!auth.session) {
              void claimReferralInstall();
              try {
                const claimed = await claimDeferredInvite();
                if (claimed) trackInvite("deferred_deeplink_received", { group_id: claimed, app_install_state: "native" });
                if (claimed && !wasInviteConsumed(claimed)) {
                  pending = claimed;
                  setPendingInvite(claimed);
                }
              } catch {
                // network unavailable
              }
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
        window.setTimeout(() => void linkReferralInstall(), 0);
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

  const openNotificationSettings = () => {
    setShowNotificationSettingsPrompt(false);
    if (nativePlatform() === "ios" && typeof window !== "undefined") {
      window.location.href = "app-settings:";
    }
  };

  return (
    <AlertDialog
      open={showNotificationSettingsPrompt}
      onOpenChange={setShowNotificationSettingsPrompt}
    >
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Turn on notifications</AlertDialogTitle>
          <AlertDialogDescription>
            Enable notifications in Settings so Pactara can remind you to check in and keep your streak.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction onClick={openNotificationSettings}>Open Settings</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
