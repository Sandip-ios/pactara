import { useEffect } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { isNative } from "@/lib/native";

const AUTO_DISMISS_MS = 4000;

/**
 * Foreground ("in-app") notifications. When a push arrives while the app is
 * open, iOS/Android suppress the system banner, so we flash our own at the top
 * of the screen. Tapping it opens the same destination as the system banner.
 */
export function InAppNotifications() {
  const navigate = useNavigate();
  const routerState = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    let handle: Promise<PluginListenerHandle> | null = null;

    (async () => {
      try {
        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
        if (cancelled) return;
        handle = FirebaseMessaging.addListener("notificationReceived", (event) => {
          const n = event?.notification;
          if (!n) return;
          const title = n.title ?? "Pactara";
          const body = n.body ?? "";
          const url = (n.data as { url?: string } | undefined)?.url;

          // Don't interrupt when the user is already looking at that screen.
          if (url && routerState && url.split("?")[0] === routerState) return;

          toast.custom(
            (id) => (
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(id);
                  if (url) void navigate({ to: url });
                }}
                className="flex w-full items-start gap-3 rounded-2xl border border-border bg-background/95 px-4 py-3 text-left shadow-lg backdrop-blur"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bell className="h-4 w-4 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
                  {body ? (
                    <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">{body}</span>
                  ) : null}
                </span>
              </button>
            ),
            { position: "top-center", duration: AUTO_DISMISS_MS },
          );
        });
      } catch (err) {
        console.warn("[push] foreground listener failed", err);
      }
    })();

    return () => {
      cancelled = true;
      void handle?.then((h) => h.remove()).catch(() => {});
    };
  }, [navigate, routerState]);

  return null;
}
