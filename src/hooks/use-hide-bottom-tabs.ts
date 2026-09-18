import { useEffect, useLayoutEffect } from "react";

/**
 * Hides the app's BottomTabs while a modal/sheet is mounted.
 * Uses a ref-counted body class so multiple stacked modals all keep tabs hidden
 * until the last one unmounts.
 */
let count = 0;
// Only callers that actually show a dim overlay (sheets/modals) darken the
// page canvas. Full-screen pages that merely hide the tabs keep the light
// canvas so the iOS status-bar area stays white with dark text.
let darkenCount = 0;
const CHANGE_EVENT = "pactara:bottom-tabs-hidden-change";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function publishHiddenState() {
  if (typeof document === "undefined") return;
  const hidden = count > 0;
  document.body.classList.toggle("modal-open", hidden);
  document.body.dataset.bottomTabsHidden = hidden ? "true" : "false";
  // Darken the page canvas so the dim overlay reaches the iOS safe areas too.
  document.documentElement.dataset.sheetOpen = darkenCount > 0 ? "true" : "false";
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, { detail: { hidden } }),
  );
}


export function areBottomTabsHidden() {
  return count > 0;
}

export function subscribeBottomTabsHidden(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export function useHideBottomTabs(active: boolean = true, darken: boolean = true) {
  useIsomorphicLayoutEffect(() => {
    if (!active || typeof document === "undefined") return;
    count += 1;
    if (darken) darkenCount += 1;
    publishHiddenState();
    return () => {
      count = Math.max(0, count - 1);
      if (darken) darkenCount = Math.max(0, darkenCount - 1);
      publishHiddenState();
    };
  }, [active, darken]);
}
