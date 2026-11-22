import { useEffect } from "react";

let cachedSafeAreaTop: number | null = null;

/**
 * Measure `env(safe-area-inset-top)` (returns 0 in browsers without a notch,
 * e.g. desktop Chrome, so the status-bar band effectively doesn't exist there).
 */
function getSafeAreaTop(): number {
  if (cachedSafeAreaTop !== null) return cachedSafeAreaTop;
  if (typeof document === "undefined" || !document.body) return 0;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;height:env(safe-area-inset-top);width:1px;visibility:hidden;pointer-events:none;";
  document.body.appendChild(probe);
  cachedSafeAreaTop = probe.getBoundingClientRect().height || 0;
  probe.remove();
  return cachedSafeAreaTop;
}

/**
 * The visible page content lives inside `fixed inset-0 overflow-y-auto`
 * containers, so find the tallest one that is actually scrolled down.
 */
function findPageScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  // Pages that mark their scroll container (Home, a crew's page) win.
  const marked = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-root]")).find(
    (el) => el.scrollTop > 0,
  );
  if (marked) return marked;
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(".overflow-y-auto"));
  let best: HTMLElement | null = null;
  for (const el of candidates) {
    if (el.scrollTop <= 0) continue;
    if (el.scrollHeight <= el.clientHeight + 1) continue;
    if (!best || el.clientHeight > best.clientHeight) best = el;
  }
  return best;
}

function scrollPageToTop() {
  const scroller = findPageScroller();
  if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * iOS delivers a status-bar tap to the WKWebView's own scroll view, not to the
 * DOM — no touch/click event ever reaches JavaScript. The webview only reacts
 * when the *document* itself can scroll, which our `fixed inset-0` pages never
 * do.
 *
 * So we keep the document scrollable by a couple of pixels and park it at that
 * offset. A status-bar tap then makes the webview scroll the document back to
 * 0, which fires a `scroll` event we can observe: that's our signal to scroll
 * the real page container to the top and re-park the document.
 */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * The native iOS app: the Capacitor status-bar plugin turns a tap on the clock
 * into a `statusTap` window event. That's the direct signal; the document
 * parking below stays as the fallback (and covers mobile Safari).
 */
export function useNativeStatusTap(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onStatusTap = () => scrollPageToTop();
    window.addEventListener("statusTap", onStatusTap);
    return () => window.removeEventListener("statusTap", onStatusTap);
  }, [enabled]);
}

/**
 * What the page looks like when a sheet, dialog or menu has locked scrolling:
 * the overlay libraries set `overflow: hidden` / `position: fixed` on the body
 * (or html), or `data-scroll-locked` on the body, while the overlay is open.
 */
export type ScrollLockSnapshot = {
  bodyOverflow: string;
  htmlOverflow: string;
  bodyPosition: string;
  scrollLockAttr: boolean;
  overlayOpen: boolean;
};

export function isScrollLocked(s: ScrollLockSnapshot): boolean {
  return (
    s.scrollLockAttr ||
    s.overlayOpen ||
    s.bodyOverflow === "hidden" ||
    s.htmlOverflow === "hidden" ||
    s.bodyPosition === "fixed"
  );
}

/**
 * While a lock is on, or just came off, a jump of the document to the top is
 * the overlay's doing, not a tap on the clock.
 */
export function shouldTreatAsStatusTap(opts: {
  scrollY: number;
  park: number;
  locked: boolean;
  msSinceLastLock: number;
}): boolean {
  if (opts.locked) return false;
  if (opts.msSinceLastLock < LOCK_GRACE_MS) return false;
  return opts.scrollY < opts.park;
}

export const LOCK_GRACE_MS = 1500;

function readScrollLock(): boolean {
  const body = document.body;
  const html = document.documentElement;
  const bs = window.getComputedStyle(body);
  const hs = window.getComputedStyle(html);
  return isScrollLocked({
    bodyOverflow: bs.overflowY,
    htmlOverflow: hs.overflowY,
    bodyPosition: bs.position,
    scrollLockAttr: body.hasAttribute("data-scroll-locked"),
    overlayOpen: !!document.querySelector(
      "[data-vaul-drawer], [role='dialog'], [role='alertdialog'], [role='menu']",
    ),
  });
}

// One shared parking setup, counted by the screens that use it. Route changes
// can mount the next screen before the previous one unmounts; a per-screen
// setup would then undo the new screen's parking.
let parkUsers = 0;
let unpark: (() => void) | null = null;

function installParking(safeTop: number): () => void {
  const PARK = 2;
  const root = document.documentElement;
  const previousMinHeight = document.body.style.minHeight;
  // Make the document scrollable by exactly PARK px.
  document.body.style.minHeight = `calc(100dvh - env(safe-area-inset-top) + ${PARK}px)`;

  let parking = false;
  // Sheets, dialogs and menus lock page scrolling while open, which can reset
  // the document offset. Stand down while that's happening (and just after),
  // so parking never fights the lock and the feed never jumps.
  let lastLockAt = -Infinity;
  const lockedNow = () => {
    const locked = readScrollLock();
    if (locked) lastLockAt = performance.now();
    return locked;
  };
  const park = () => {
    parking = true;
    window.scrollTo(0, PARK);
    window.setTimeout(() => {
      parking = false;
    }, 50);
  };
  park();

  const onScroll = () => {
    if (parking) return;
    const locked = lockedNow();
    if (locked) return;
    if (
      shouldTreatAsStatusTap({
        scrollY: window.scrollY,
        park: PARK,
        locked,
        msSinceLastLock: performance.now() - lastLockAt,
      })
    ) {
      scrollPageToTop();
      park();
    } else if (window.scrollY < PARK) {
      // A lock just came off and left the document at 0: re-park quietly.
      park();
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });

  // Re-park quietly if something else reset the document (route scroll
  // restoration, or parking before the page was tall enough to scroll).
  const keepParked = window.setInterval(() => {
    if (lockedNow()) return;
    if (!parking && window.scrollY < PARK) park();
  }, 1000);

  // Fallback for environments where the tap does reach the DOM.
  const handleTap = (event: TouchEvent) => {
    if (safeTop <= 0) return;
    const clientY = event.changedTouches[0]?.clientY;
    if (clientY === undefined || clientY > safeTop + 4) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest(
        "button, a, input, textarea, select, [role='button'], [data-no-status-bar-scroll]",
      )
    ) {
      return;
    }
    if (lockedNow()) return;
    scrollPageToTop();
  };
  document.addEventListener("touchend", handleTap, { capture: true, passive: true });

  return () => {
    window.clearInterval(keepParked);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("touchend", handleTap, { capture: true });
    document.body.style.minHeight = previousMinHeight;
    root.scrollTop = 0;
    window.scrollTo(0, 0);
  };
}

export function useStatusBarScrollToTop(enabled = true) {
  useNativeStatusTap(enabled);
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const safeTop = getSafeAreaTop();
    // Desktop preview / non-iOS: nothing to hook into. Mobile Safari reports
    // no top inset (its own bar owns the notch) but still scrolls the document
    // to the top on a clock tap, so park the document there too.
    if (safeTop <= 0 && !isIOS()) return;

    parkUsers += 1;
    if (!unpark) unpark = installParking(safeTop);
    else window.scrollTo(0, 2);
    return () => {
      parkUsers -= 1;
      if (parkUsers <= 0 && unpark) {
        parkUsers = 0;
        unpark();
        unpark = null;
      }
    };
  }, [enabled]);
}
