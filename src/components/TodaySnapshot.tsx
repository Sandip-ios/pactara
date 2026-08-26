import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

const PURPLE = "#7C3AED";

export type SnapshotState = "ritual" | "check-in" | "done";

type Props = {
  state: SnapshotState;
  week: { label: string; done: boolean }[];
  streak: number;
  totalCheckIns: number;
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

const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function TodaySnapshot({ state, week, streak, totalCheckIns }: Props) {
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

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-white shadow-sm overflow-hidden">
      <div
        ref={trackRef}
        className="flex transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Slide 1 — Today's commitment */}
        <div className="w-full shrink-0">
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
        <div className="w-full shrink-0">
          <div className="px-4 pt-4 flex items-center justify-between">
            <span className="text-[15px] font-bold text-neutral-900">This week</span>
            <span className="text-[13px] font-semibold text-neutral-400">
              {completedCount}/7 days
            </span>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-end gap-2">
              <div className="flex flex-col items-center justify-center">
                <span className="text-[32px] font-black leading-none text-neutral-900">
                  {streak}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mt-1">
                  {streak === 1 ? "day streak" : "day streak"}
                </span>
              </div>
              <div className="flex-1 flex items-center justify-end gap-1.5">
                {week.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold text-neutral-400">
                      {DOW_LABELS[i]}
                    </span>
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center"
                      style={{
                        background: d.done ? PURPLE : "#F3F3F4",
                      }}
                    >
                      {d.done && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
