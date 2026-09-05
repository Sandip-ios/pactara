import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

const PURPLE = "#7C3AED";

export type SnapshotState = "ritual" | "check-in" | "done";

type Props = {
  state: SnapshotState;
  week: { label: string; done: boolean }[];
  streak: number;
  longestStreak: number;
  pace?: {
    dayNumber: number;
    durationDays: number;
    checkIns: number;
    expected: number;
    totalSessions: number;
    pacePct: number;
  } | null;
};

const COPY: Record<
  SnapshotState,
  { title: string; message: string; cta: string | null }
> = {
  ritual: {
    title: "Today's commitment",
    message: "Set your commitment for today so your group knows the plan.",
    cta: "Commit now",
  },
  "check-in": {
    title: "Check in",
    message: "Morning's done — check in and keep your streak alive.",
    cta: "Check in",
  },
  done: {
    title: "All set",
    message: "You're all set for today. Nice work.",
    cta: null,
  },
};

type Stat = { label: string; value: string };




export function TodaySnapshot({ state, week, streak, longestStreak, pace }: Props) {
  const navigate = useNavigate();
  const copy = COPY[state];

  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const deltaX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const SLIDES = 2;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    deltaX.current = 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    deltaX.current = e.touches[0].clientX - startX.current;
  };

  const onTouchEnd = () => {
    if (startX.current === null) return;
    const threshold = 40;
    if (deltaX.current < -threshold && index < SLIDES - 1) {
      setIndex((i) => Math.min(i + 1, SLIDES - 1));
    } else if (deltaX.current > threshold && index > 0) {
      setIndex((i) => Math.max(i - 1, 0));
    } else {
      // snap back
      setIndex((i) => i);
    }
    startX.current = null;
    deltaX.current = 0;
  };

  const completedCount = week.filter((d) => d.done).length;

  const stats: Stat[] = [
    { label: "Day streak", value: String(streak) },
    { label: "This week", value: `${completedCount}/7` },
    { label: "Longest streak", value: String(longestStreak) },
  ];

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-white shadow-sm overflow-hidden">
      <div
        ref={trackRef}
        className="flex items-start transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Slide 1 — Today's commitment */}
        <div
          className="w-full shrink-0 overflow-hidden"
          style={{ maxHeight: index === 0 ? 400 : 0 }}
          aria-hidden={index !== 0}
        >
          <div className="px-4 pt-4">
            <span className="text-[15px] font-bold text-neutral-900">{copy.title}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-4">
            <p className="flex-1 text-[15px] leading-[1.35] text-neutral-700">{copy.message}</p>
            {copy.cta && (
              <button
                onClick={() => navigate({ to: "/check-in" })}
                className="shrink-0 rounded-full px-4 py-2.5 text-[14px] font-bold text-white active:scale-[0.98]"
                style={{ background: PURPLE }}
              >
                {copy.cta}
              </button>
            )}
          </div>
        </div>

        {/* Slide 2 — Weekly snapshot */}
        <div
          className="w-full shrink-0 overflow-hidden"
          style={{ maxHeight: index === 1 ? 400 : 0 }}
          aria-hidden={index !== 1}
        >
          <div className="px-4 pt-4">
            <span className="text-[15px] font-bold text-neutral-900">Weekly snapshot</span>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              {stats.map((s, i) => (
                <div key={i} className="flex flex-col items-center text-center" style={{ flex: 1 }}>
                  <span className="text-[26px] font-black leading-none text-neutral-900">
                    {s.value}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mt-1.5">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            {pace && (
              <div className="mt-3.5 border-t border-neutral-100 pt-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-neutral-700">
                    Day {pace.dayNumber} of {pace.durationDays}
                  </span>
                  <span
                    className="font-bold"
                    style={{ color: pace.pacePct >= 100 ? "#16A34A" : pace.pacePct >= 80 ? PURPLE : "#EA580C" }}
                  >
                    {pace.pacePct}% on pace
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, pace.pacePct)}%`,
                      background: pace.pacePct >= 100 ? "#16A34A" : pace.pacePct >= 80 ? PURPLE : "#EA580C",
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-neutral-500">
                  {pace.checkIns} of {pace.totalSessions} sessions done
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Carousel dots */}
      <div className="flex items-center justify-center gap-1.5 pb-3 pt-1">
        {Array.from({ length: SLIDES }).map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className="h-1.5 rounded-full transition-all duration-200"
            style={{
              width: i === index ? 18 : 6,
              background: i === index ? PURPLE : "#D4D4D8",
            }}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
