import { useEffect } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { isNative } from "@/lib/native";

const AUTO_DISMISS_MS = 4000;

/**
 * sonner wraps our card in a <li> that also gets the Toaster's default
 * background, border and shadow (toastOptions.classNames.toast in
 * src/components/ui/sonner.tsx). That painted an empty white strip above the
 * card, so this toast clears the wrapper: only our rounded card is visible.
 * The trailing `!` matters, the Toaster's own classes are not important.
 */
const WRAPPER_RESET = "bg-transparent! border-0! shadow-none! p-0!";

export type ForegroundNotification = {
  title?: string | null;
  body?: string | null;
  // The native plugin hands this over as an untyped bag of keys.
  data?: unknown;
};

/**
 * Flash the banner for a push that arrived while the app was open.
 *
 * Badge-only pushes (sendBadgeUpdate in src/lib/fcm.server.ts) still fire
 * notificationReceived with no text at all, so a push with neither a title nor
 * a body shows nothing. The "Pactara" title is only a fallback for a push that
 * does have something to say.
 */
export function showForegroundNotification(
  n: ForegroundNotification,
  navigate: (href: string) => void,
) {
  const title = (n.title ?? "").trim();
  const body = (n.body ?? "").trim();
  if (!title && !body) return;
  const heading = title || "Pactara";
  const url = (n.data as { url?: string } | null | undefined)?.url;

  toast.custom(
    (id) => (
      <button
        type="button"
        onClick={() => {
          toast.dismiss(id);
          if (url) void navigate(url);
        }}
        className="flex w-full items-start gap-3 rounded-2xl border border-border bg-background/95 px-4 py-3 text-left shadow-lg backdrop-blur"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-4 w-4 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{heading}</span>
          {body ? (
            <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">{body}</span>
          ) : null}
        </span>
      </button>
    ),
    {
      position: "top-center",
      duration: AUTO_DISMISS_MS,
      unstyled: true,
      className: WRAPPER_RESET,
    },
  );
}

/**
 * Foreground ("in-app") notifications. When a push arrives while the app is
 * open, iOS/Android suppress the system banner, so we flash our own at the top
 * of the screen. Tapping it opens the same destination as the system banner.
 */
export function InAppNotifications() {
  const navigate = useNavigate();

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
          showForegroundNotification(n, (href) => void navigate({ href }));
        });
      } catch (err) {
        console.warn("[push] foreground listener failed", err);
      }
    })();

    return () => {
      cancelled = true;
      void handle?.then((h) => h.remove()).catch(() => {});
    };
  }, [navigate]);

  return null;
}
