import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Camera, Check, Moon } from "lucide-react";
import { WorkoutCard } from "@/components/WorkoutCard";
import { CheckInShareModal } from "@/components/CheckInShareModal";
import type { MoodId } from "@/routes/_authenticated/check-in.index";
import { todayCheckedInSubtitle, todayHeadline, weekFooterNote } from "@/lib/crew-today";

const PURPLE = "#7C3AED";

export type TodayState = "check-in" | "done" | "rest";

/** The single Today card: check in, you're in, or rest day, plus this week's tally. */
export function TodayCard({
  state,
  groupId,
  streak,
  inCount,
  dueCount,
  solo,
  week,
  myCheckIn,
}: {
  state: TodayState;
  groupId: string | null;
  streak: number;
  inCount: number;
  /** Crew members due today (resting members left out). */
  dueCount: number;
  solo: boolean;
  week: { workouts: number; target: number; restLeft: number } | null;
  myCheckIn: { mood: string | null; activity: string | null; note: string; photoUrl: string | null } | null;
}) {
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);
  // iOS: when the keyboard collapses mid-tap the later click event dispatches at
  // stale screen coordinates and can land on another element (e.g. the home
  // composer's photo button, which opens the file picker). Navigate at touch
  // time instead, and only when the touch didn't move (not a scroll/swipe).
  const ctaTouch = useRef<{ x: number; y: number } | null>(null);
  const goToCheckIn = () => navigate({ to: "/check-in" });
  const onCtaTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) ctaTouch.current = { x: t.clientX, y: t.clientY };
  };
  const onCtaTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    const start = ctaTouch.current;
    ctaTouch.current = null;
    if (t && start && Math.hypot(t.clientX - start.x, t.clientY - start.y) < 12) {
      goToCheckIn();
    }
  };

  const label = (
    <span className="text-[12px] font-bold uppercase tracking-[0.6px]" style={{ color: PURPLE }}>
      Today
    </span>
  );

  const body =
    state === "rest" ? (
      <div className="flex flex-col gap-[14px] px-[18px] pt-[18px]">
        {label}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "#EDE6FE" }}>
            <Moon size={20} style={{ color: PURPLE }} />
          </span>
          <h2 className="text-[20px] font-extrabold leading-tight text-neutral-900">
            Rest day. Your streak is safe.
          </h2>
        </div>
      </div>
    ) : state === "done" ? (
      <div className="flex flex-col gap-[14px] px-[18px] pt-[18px]">
        {label}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
            <Check size={22} strokeWidth={3} className="text-green-600" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[20px] font-extrabold leading-tight text-neutral-900">
              {todayHeadline({ inCount, dueCount, solo, checkedIn: true })}
            </h2>
            <p className="mt-0.5 text-[14px] text-neutral-500">
              {todayCheckedInSubtitle({ inCount, dueCount, solo })}
            </p>
          </div>
        </div>
        {myCheckIn && (
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="h-12 w-full rounded-full border-2 text-[15px] font-bold active:opacity-80"
            style={{ borderColor: PURPLE, color: PURPLE }}
          >
            Share your check-in
          </button>
        )}
      </div>
    ) : (
      <div className="flex flex-col gap-[14px] px-[18px] pt-[18px]">
        {label}
        <h2 className="text-pretty text-[20px] font-extrabold leading-tight text-neutral-900">
          {todayHeadline({ inCount, dueCount, solo, checkedIn: false })}
        </h2>
        <button
          type="button"
          onClick={goToCheckIn}
          onTouchStart={onCtaTouchStart}
          onTouchEnd={onCtaTouchEnd}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[26px] text-[16px] font-bold text-white active:scale-[0.99]"
          style={{ background: PURPLE }}
        >
          <Camera size={20} />
          Check in with video
        </button>
      </div>
    );

  const note = week ? weekFooterNote(week) : null;

  return (
    <section className="mx-4 mt-4 overflow-hidden rounded-[20px] bg-white shadow-sm">
      {state === "rest" ? body : <WorkoutCard groupId={groupId} streak={streak} embedded fallback={body} />}
      <div className="mx-[18px] mt-[14px] border-t pb-[18px] pt-[14px] text-[13px]" style={{ borderColor: "#F0EDE9" }}>
        {week && note ? (
          <span className="whitespace-nowrap font-semibold text-neutral-700">
            {week.workouts} of {week.target} check-ins this week{" "}
            <span className={note.tone === "green" ? "font-bold" : "font-normal text-neutral-500"} style={note.tone === "green" ? { color: "#15803D" } : undefined}>
              · {note.text}
            </span>
          </span>
        ) : (
          <span className="block h-4 w-44 animate-pulse rounded-md bg-neutral-200" />
        )}
      </div>
      {sharing &&
        myCheckIn &&
        // Portaled so the full-screen share card isn't clipped by the scrolling page.
        createPortal(
        <CheckInShareModal
          data={{
            mood: (myCheckIn.mood as MoodId | null) ?? null,
            activity: myCheckIn.activity,
            note: myCheckIn.note,
            photoUrl: myCheckIn.photoUrl,
            photoBlob: null,
          }}
          onClose={() => setSharing(false)}
        />,
          document.body,
        )}
    </section>
  );
}

export function TodayCardSkeleton() {
  return (
    <section className="mx-4 mt-4 overflow-hidden rounded-[20px] bg-white p-[18px] shadow-sm" aria-hidden>
      <div className="flex flex-col gap-[14px]">
        <div className="h-3 w-12 animate-pulse rounded bg-neutral-200" />
        <div className="h-6 w-4/5 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-[52px] w-full animate-pulse rounded-[26px] bg-neutral-200" />
      </div>
      <div className="mt-[14px] border-t pt-[14px]" style={{ borderColor: "#F0EDE9" }}>
        <div className="h-4 w-44 animate-pulse rounded-md bg-neutral-200" />
      </div>
    </section>
  );
}
