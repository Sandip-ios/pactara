import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const PURPLE = "#7C3AED";
const THRESHOLD = 70;
const MAX_PULL = 110;

function isAtScrollTop(el: EventTarget | null): boolean {
  let cur = el instanceof HTMLElement ? el : null;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    const style = getComputedStyle(cur);
    if (/(auto|scroll)/.test(style.overflowY) && cur.scrollHeight > cur.clientHeight) {
      return cur.scrollTop <= 0;
    }
    cur = cur.parentElement;
  }
  const doc = document.scrollingElement || document.documentElement;
  return (doc?.scrollTop ?? 0) <= 0;
}

type Props = {
  onRefresh: () => Promise<unknown> | unknown;
  /** distance from top of viewport for the indicator (below the top bar). */
  topOffset?: number;
};

export function PullToRefresh({ onRefresh, topOffset = 64 }: Props) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const activeRef = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (e.touches.length !== 1) return;
      if (!isAtScrollTop(e.target)) return;
      startY.current = e.touches[0].clientY;
      activeRef.current = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!activeRef.current || startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        setDragging(false);
        return;
      }
      // Only engage after a small threshold to avoid competing with taps.
      if (dy < 6) return;
      setDragging(true);
      // Damping curve.
      const damped = Math.min(MAX_PULL, dy * 0.5);
      pullRef.current = damped;
      setPull(damped);
    };
    const onEnd = async () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      startY.current = null;
      const p = pullRef.current;
      setDragging(false);
      if (p >= THRESHOLD && !refreshingRef.current) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await onRefresh();
        } catch {
          // swallow — indicator hides regardless
        } finally {
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
        }
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh]);

  const visible = refreshing || pull > 0;
  const progress = Math.min(1, pull / THRESHOLD);
  const translate = refreshing ? topOffset + 8 : topOffset + Math.min(pull, MAX_PULL) - 20;
  const opacity = refreshing ? 1 : Math.max(0.15, progress);
  const rotate = refreshing ? 0 : progress * 270;

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        pointerEvents: "none",
        zIndex: 50,
        transform: `translateY(${translate}px)`,
        transition: dragging ? "none" : "transform 260ms ease, opacity 200ms ease",
        opacity: visible ? 1 : 0,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          height: 36,
          width: 36,
          borderRadius: 999,
          background: "white",
          boxShadow: "0 4px 12px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity,
          transform: `rotate(${rotate}deg)`,
          transition: dragging ? "none" : "transform 260ms ease, opacity 200ms ease",
        }}
      >
        <RefreshCw
          size={18}
          color={PURPLE}
          className={refreshing ? "animate-spin" : ""}
        />
      </div>
    </div>
  );
}
