import { useEffect, type RefObject } from "react";

/**
 * Keeps toasts above whatever bar is fixed to the bottom of the screen (the
 * tab bar, the minimized workout bar, a screen's own button bar): the toast
 * sits 12px above the highest one. Sonner reads `--toast-bottom`.
 */
const bars = new Set<HTMLElement>();
const GAP = 12;

/** Toast bottom offset for the given bar tops (distance from the screen bottom). */
export function toastBottomFor(barHeights: number[], gap = GAP): number | null {
  const tallest = Math.max(0, ...barHeights.filter((h) => Number.isFinite(h) && h > 0));
  return tallest > 0 ? Math.round(tallest + gap) : null;
}

function publish() {
  if (typeof document === "undefined") return;
  const vh = window.innerHeight;
  const px = toastBottomFor([...bars].filter((el) => el.isConnected).map((el) => vh - el.getBoundingClientRect().top));
  const root = document.documentElement;
  if (px == null) root.style.removeProperty("--toast-bottom");
  else root.style.setProperty("--toast-bottom", `${px}px`);
}

export function useToastAbove(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    bars.add(el);
    publish();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    ro?.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      bars.delete(el);
      ro?.disconnect();
      window.removeEventListener("resize", publish);
      publish();
    };
  }, [ref, active]);
}
