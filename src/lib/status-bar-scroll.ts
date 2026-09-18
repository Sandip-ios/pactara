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

function findScrollContainer(el: Element | null): HTMLElement | null {
  let node: HTMLElement | null = el instanceof HTMLElement ? el : null;
  while (node && node !== document.body) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * iOS only scrolls the *document* to the top when the status bar is tapped.
 * Pages that scroll inside a `fixed inset-0 overflow-y-auto` container never
 * get that behavior, so we listen for taps inside the status-bar band and
 * scroll the container under the tap to the top ourselves.
 */
export function useStatusBarScrollToTop(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const handleTap = (event: TouchEvent | MouseEvent) => {
      const clientY =
        "changedTouches" in event && event.changedTouches.length > 0
          ? event.changedTouches[0].clientY
          : event.clientY;

      const safeTop = getSafeAreaTop();
      if (safeTop <= 0 || clientY > safeTop + 4) return;

      const target = event.target instanceof Element ? event.target : null;
      // Never hijack taps on interactive elements that happen to sit near the top.
      if (target?.closest("button, a, input, textarea, select, [role='button'], [data-no-status-bar-scroll]")) {
        return;
      }

      const container = findScrollContainer(target);
      if (container) {
        container.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    document.addEventListener("touchend", handleTap, { capture: true, passive: true });
    document.addEventListener("click", handleTap, { capture: true });
    return () => {
      document.removeEventListener("touchend", handleTap, { capture: true });
      document.removeEventListener("click", handleTap, { capture: true });
    };
  }, [enabled]);
}
