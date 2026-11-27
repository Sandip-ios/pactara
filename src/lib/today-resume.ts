import { useSyncExternalStore } from "react";

/** True while Home's Today card shows Resume on screen; the global workout bar steps aside. */
let visible = false;
const subs = new Set<() => void>();
export function setTodayResumeVisible(v: boolean) {
  if (v === visible) return;
  visible = v;
  subs.forEach((f) => f());
}
export function useTodayResumeVisible() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => visible,
    () => false,
  );
}
