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
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(".overflow-y-auto, [data-scroll-root]"),
  );
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
export function useStatusBarScrollToTop(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const safeTop = getSafeAreaTop();
    // No notch (desktop preview / non-iOS): nothing to hook into.
    if (safeTop <= 0) return;

    const PARK = 2;
    const root = document.documentElement;
    const previousMinHeight = document.body.style.minHeight;
    // Make the document scrollable by exactly PARK px.
    document.body.style.minHeight = `calc(100dvh - env(safe-area-inset-top) + ${PARK}px)`;

    let parking = false;
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
      if (window.scrollY < PARK) {
        scrollPageToTop();
        park();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    // Fallback for environments where the tap does reach the DOM.
    const handleTap = (event: TouchEvent) => {
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
      scrollPageToTop();
    };
    document.addEventListener("touchend", handleTap, { capture: true, passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("touchend", handleTap, { capture: true });
      document.body.style.minHeight = previousMinHeight;
      root.scrollTop = 0;
      window.scrollTo(0, 0);
    };
  }, [enabled]);
}
