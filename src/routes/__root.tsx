import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreen } from "@/components/SplashScreen";
import { ensureLaunchScreenGone, launchScreenUp, markLaunchRouteSettled } from "@/lib/launch-screen";
import { InAppNotifications } from "@/components/InAppNotifications";
import { NativeBootstrap } from "@/components/NativeBootstrap";
import { PostHogProvider } from "@/components/PostHogProvider";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const msg = (error as Error | undefined)?.message || "";
  const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  useEffect(() => {
    if (!isChunkError || typeof window === "undefined") return;
    const RELOAD_KEY = "__chunk_reload_at";
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 10_000) return; // avoid reload loops
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }, [isChunkError]);


  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (isChunkError) {
                window.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#FFFFFF" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Pactara" },
      { title: "Pactara — Accountability that actually works." },
      { name: "description", content: "Daily check-ins. Real streaks. Keep promises with the people who matter." },
      { name: "author", content: "Pactara" },
      { property: "og:title", content: "Accountability that actually works." },
      { property: "og:description", content: "Daily check-ins. Real streaks." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Pactara" },
      { property: "og:image", content: "https://pactara.lovable.app/__l5e/assets-v1/49f16183-81b1-465b-9903-3de2105de7ba/pactara-og.jpg" },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { property: "og:image:alt", content: "Pactara — Accountability that actually works." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Accountability that actually works." },
      { name: "twitter:description", content: "Daily check-ins. Real streaks." },
      { name: "twitter:image", content: "https://pactara.lovable.app/__l5e/assets-v1/49f16183-81b1-465b-9903-3de2105de7ba/pactara-og.jpg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png?v=3" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=3" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Caveat:wght@600;700&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Onest:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  // The launch screen covers pages the server can't draw (the entry and the
  // signed-in app); server-drawn public pages (invites, legal) show directly.
  // Decided once per page load, identically on server and client.
  const [showLaunch] = useState(() =>
    router.state.matches.some((m) => {
      const route = (router.routesById as unknown as Record<string, { options?: { ssr?: unknown } } | undefined>)[m.routeId];
      const ssr = route?.options?.ssr;
      return ssr === false;
    }),
  );
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SplashScreen show={showLaunch} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Fades the launch screen once the router has settled on the first screen. */
function LaunchController() {
  const router = useRouter();
  // While the launch decides where to go, load the likeliest screens' code.
  useEffect(() => {
    if (!launchScreenUp()) return;
    for (const id of ["/_authenticated", "/_authenticated/home"]) {
      const route = (router.routesById as unknown as Record<string, unknown>)[id];
      if (route) void Promise.resolve(router.loadRouteChunk(route as never)).catch(() => undefined);
    }
  }, [router]);
  const settledAt = useRouterState({
    select: (s) => (s.status === "idle" && !s.isLoading ? s.location.pathname : null),
  });
  useEffect(() => {
    if (settledAt !== null) markLaunchRouteSettled(settledAt);
    ensureLaunchScreenGone();
  }, [settledAt]);
  useEffect(() => {
    window.addEventListener("pactara:launch-done", ensureLaunchScreenGone);
    return () => window.removeEventListener("pactara:launch-done", ensureLaunchScreenGone);
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const RELOAD_KEY = "__chunk_reload_at";
    const isChunkError = (msg: string) =>
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);
    const maybeReload = (msg: string) => {
      if (!isChunkError(msg)) return;
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last < 10_000) return; // avoid reload loops
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    };
    const onError = (e: ErrorEvent) => maybeReload(e.message || "");
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const msg = typeof reason === "string" ? reason : reason?.message ?? "";
      maybeReload(msg);
    };
    const onPreloadError = (e: Event) => maybeReload((e as CustomEvent).type + " preload");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("vite:preloadError", onPreloadError as EventListener);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("vite:preloadError", onPreloadError as EventListener);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PostHogProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster />
        <LaunchController />
        <NativeBootstrap />
        <InAppNotifications />
      </PostHogProvider>
    </QueryClientProvider>

  );
}
