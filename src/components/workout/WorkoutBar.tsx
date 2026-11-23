import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { fmtClock } from "@/lib/lift-rules";
import { getActiveWorkout, updateActiveWorkout, useActiveWorkout } from "@/lib/active-workout";
import { restEnded } from "./RestAlarm";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * While a workout is open: the slim "Resume" bar above the tabs on every other
 * screen, and the rest-timer alarm (wherever the member is).
 */
export function WorkoutBar({ tabsVisible }: { tabsVisible: boolean }) {
  const w = useActiveWorkout();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const now = useNow(1000);
  const [tabsH, setTabsH] = useState(72);

  // Rest timer ran out: beep, buzz, clear it.
  useEffect(() => {
    if (!w?.rest || now < w.rest.endsAt) return;
    const endsAt = w.rest.endsAt;
    updateActiveWorkout((x) => (x.rest?.endsAt === endsAt ? { ...x, rest: null } : x));
    if (now - endsAt < 5000) void restEnded();
  }, [w?.rest, now]);

  useEffect(() => {
    if (!tabsVisible) return;
    const el = document.querySelector("[data-bottom-tabs]") as HTMLElement | null;
    if (!el) return;
    const ro = new ResizeObserver(() => setTabsH(el.offsetHeight));
    ro.observe(el);
    setTabsH(el.offsetHeight);
    return () => ro.disconnect();
  }, [tabsVisible, w?.id]);

  if (!w || pathname.startsWith("/workout/log") || pathname.startsWith("/check-in/camera")) return null;
  return (
    <button
      type="button"
      data-workout-bar
      onClick={() => navigate({ to: "/workout/log" })}
      className="fixed inset-x-0 z-[61] flex h-12 items-center justify-center gap-1.5 px-4 text-[15px] text-white"
      style={{
        background: "#7C3AED",
        bottom: tabsVisible ? tabsH : 0,
        paddingBottom: tabsVisible ? 0 : "env(safe-area-inset-bottom)",
        height: tabsVisible ? 48 : "calc(48px + env(safe-area-inset-bottom))",
        fontFamily: "Inter, system-ui, sans-serif",
        fontVariantNumeric: "tabular-nums",
      }}
      aria-label={`${w.title}, ${fmtClock((now - w.startedAt) / 1000)}. Resume workout`}
    >
      <span className="min-w-0 truncate font-semibold">{w.title}</span>
      <span aria-hidden>·</span>
      <span className="font-semibold">{fmtClock((now - w.startedAt) / 1000)}</span>
      <span aria-hidden>·</span>
      <span className="font-extrabold">Resume</span>
    </button>
  );
}

export const hasActiveWorkout = () => !!getActiveWorkout();
