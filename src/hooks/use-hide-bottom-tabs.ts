import { useEffect } from "react";

/**
 * Hides the app's BottomTabs while a modal/sheet is mounted.
 * Uses a ref-counted body class so multiple stacked modals all keep tabs hidden
 * until the last one unmounts.
 */
let count = 0;

export function useHideBottomTabs(active: boolean = true) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    count += 1;
    document.body.classList.add("modal-open");
    return () => {
      count = Math.max(0, count - 1);
      if (count === 0) document.body.classList.remove("modal-open");
    };
  }, [active]);
}
