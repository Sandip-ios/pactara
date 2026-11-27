import { useEffect, useRef, useState } from "react";
import { useToastAbove } from "@/lib/toast-offset";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { fmtClock } from "@/lib/lift-rules";
import { getActiveWorkout, updateActiveWorkout, useActiveWorkout } from "@/lib/active-workout";
import { restEnded } from "./RestAlarm";
import { useTodayResumeVisible } from "@/lib/today-resume";

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
  // A How to page opened from inside the workout has its own way back (Close / Swap in).
  const fromLogger = useRouterState({ select: (s) => pathname.endsWith("/how-to") && typeof (s.location.search as { swap?: unknown }).swap === "string" });
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
    if (!tabsVisible || !w) return;
    // The tabs can mount after the bar, and a hidden nav measures 0: keep re-measuring.
    let ro: ResizeObserver | null = null;
    let seen: HTMLElement | null = null;
    const measure = () => {
      const el = document.querySelector("[data-bottom-tabs]") as HTMLElement | null;
      if (el && el !== seen) {
        ro?.disconnect();
        seen = el;
        ro = new ResizeObserver(() => { if (el.offsetHeight > 0) setTabsH(el.offsetHeight); });
        ro.observe(el);
      }
      if (el && el.offsetHeight > 0) setTabsH(el.offsetHeight);
    };
    measure();
    const t = window.setInterval(measure, 500);
    return () => { window.clearInterval(t); ro?.disconnect(); };
  }, [tabsVisible, w?.id]);
  const todayResume = useTodayResumeVisible();

  const hidden = !w || fromLogger || (todayResume && pathname.startsWith("/home")) || pathname.startsWith("/workout/log") || pathname.startsWith("/check-in/camera");
  const barRef = useRef<HTMLButtonElement>(null);
  useToastAbove(barRef, !hidden);
  // Full-screen pages (no tabs) pad their bottom by this so nothing hides behind the bar.
  const padOn = !hidden && !tabsVisible;
  useEffect(() => {
    const root = document.documentElement.style;
    if (padOn) root.setProperty("--workout-bar-pad", "calc(48px + env(safe-area-inset-bottom))");
    else root.removeProperty("--workout-bar-pad");
    return () => { root.removeProperty("--workout-bar-pad"); };
  }, [padOn]);
  if (hidden) return null;
  return (
    <button
      ref={barRef}
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
