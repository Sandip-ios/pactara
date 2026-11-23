import { useLayoutEffect } from "react";

/**
 * App side of the launch screen (markup + fade live in SplashScreen.tsx).
 * The screen stays up until the first destination is ready to render: the
 * router has settled on it and no screen still holds it (Home holds it until
 * its first data is in; the app layout holds it while its start-up checks
 * run). Then it fades out. After the 2.5s cap (inline script) it fades as
 * soon as the destination is known, without waiting for holds.
 */
type LaunchApi = {
  done: boolean;
  revealed: boolean;
  /** The 2.5s cap has passed: stop waiting for data holds. */
  capped?: boolean;
  /** The router has settled on the first destination. */
  settled?: boolean;
  release: () => void;
};

function api(): LaunchApi | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { __pactaraLaunch?: LaunchApi }).__pactaraLaunch ?? null) as LaunchApi | null;
}

/** True while the launch screen is still covering the app. */
export function launchScreenUp(): boolean {
  const a = api();
  return !!a && !a.done;
}

const holds = new Set<symbol>();
let routeSettled = false;
let scheduled = false;

function tryRelease() {
  if (scheduled) return;
  scheduled = true;
  // Two frames: the destination has committed and painted under the cover.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      scheduled = false;
      const a = api();
      if (a && routeSettled && (holds.size === 0 || a.capped)) a.release();
    }),
  );
}

// The entry screen ("/") only counts as a destination once the launch decided
// to stay there (signed-out web landing page); before that it is just the
// moment between page load and the redirect.
let entryIsDestination = false;
export function markEntryIsDestination() {
  entryIsDestination = true;
}

/** The router has settled on a screen (call each time it goes idle). */
export function markLaunchRouteSettled(pathname: string) {
  if (!launchScreenUp()) return;
  if ((pathname === "/" || pathname === "") && !entryIsDestination) return;
  routeSettled = true;
  const a = api();
  if (a) a.settled = true;
  tryRelease();
}

/** Keep the launch screen up while `pending` (bounded by the 2.5s cap). */
export function useLaunchHold(pending: boolean) {
  useLayoutEffect(() => {
    if (!pending || !launchScreenUp()) return;
    const id = Symbol("launch-hold");
    holds.add(id);
    return () => {
      holds.delete(id);
      tryRelease();
    };
  }, [pending]);
}

// Start-up checks (goal, pact, partner match) run once during the launch;
// the app layout skips its own first check when they already ran.
let startupChecksRan = false;
export function markStartupChecksRan() {
  startupChecksRan = true;
}
export function didStartupChecksRun(): boolean {
  return startupChecksRan;
}

/**
 * After the launch: make sure no launch-screen node is left covering the app
 * (e.g. if React had to redraw the page from scratch after the fade).
 */
export function ensureLaunchScreenGone() {
  if (typeof document === "undefined") return;
  const a = api();
  if (a && !a.done) return;
  const el = document.getElementById("launch-screen");
  if (el) el.style.display = "none";
}
