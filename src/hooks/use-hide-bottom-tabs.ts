import { useEffect, useLayoutEffect } from "react";

/**
 * Hides the app's BottomTabs while a modal/sheet is mounted.
 * Uses a ref-counted body class so multiple stacked modals all keep tabs hidden
 * until the last one unmounts.
 */
let count = 0;
const CHANGE_EVENT = "pactara:bottom-tabs-hidden-change";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function publishHiddenState() {
  if (typeof document === "undefined") return;
  const hidden = count > 0;
  document.body.classList.toggle("modal-open", hidden);
  document.body.dataset.bottomTabsHidden = hidden ? "true" : "false";
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

export function useHideBottomTabs(active: boolean = true) {
  useIsomorphicLayoutEffect(() => {
    if (!active || typeof document === "undefined") return;
    count += 1;
    publishHiddenState();
    return () => {
      count = Math.max(0, count - 1);
      publishHiddenState();
    };
  }, [active]);
}
