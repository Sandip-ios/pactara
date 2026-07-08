import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreen } from "@/components/SplashScreen";
import { NativeBootstrap } from "@/components/NativeBootstrap";

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const msg = error?.message || "";
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Pactara" },
      { title: "Pactara — Accountability that actually works." },
      { name: "description", content: "Daily check-ins. Group nudges. Streaks. Keep promises with the people who matter." },
      { name: "author", content: "Pactara" },
      { property: "og:title", content: "Accountability that actually works." },
      { property: "og:description", content: "Daily check-ins. Group nudges. Streaks." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Pactara" },
      { property: "og:image", content: "https://pactara.lovable.app/__l5e/assets-v1/49f16183-81b1-465b-9903-3de2105de7ba/pactara-og.jpg" },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
      { property: "og:image:alt", content: "Pactara — Accountability that actually works." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Accountability that actually works." },
      { name: "twitter:description", content: "Daily check-ins. Group nudges. Streaks." },
      { name: "twitter:image", content: "https://pactara.lovable.app/__l5e/assets-v1/49f16183-81b1-465b-9903-3de2105de7ba/pactara-og.jpg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
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
      {/* White band covering the iOS status bar safe area */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[9999] bg-white pointer-events-none"
        style={{ height: "env(safe-area-inset-top)" }}
      />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
      <SplashScreen />
      <NativeBootstrap />
    </QueryClientProvider>
  );
}
