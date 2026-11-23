import { useRouter } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";

/**
 * Full-screen pages scroll inside their own fixed container, and the router's
 * scroll memory copies the previous page's container position onto the next
 * one (same selector). Attach the returned ref to the page's scroll container
 * so forward navigations open at the top; going back keeps the remembered spot.
 */
export function useOpenAtTop<T extends HTMLElement = HTMLDivElement>() {
  const router = useRouter();
  const ref = useRef<T | null>(null);
  useLayoutEffect(() => {
    ref.current?.scrollTo(0, 0);
    return router.subscribe("onRendered", (e) => {
      const to = e.toLocation.state.__TSR_index;
      const from = e.fromLocation?.state.__TSR_index;
      if (typeof from === "number" && typeof to === "number" && to < from) return; // back: keep the restored spot
      ref.current?.scrollTo(0, 0);
    });
  }, [router]);
  return ref;
}
