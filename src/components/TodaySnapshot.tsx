import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { WorkoutCard } from "@/components/WorkoutCard";
import { Button } from "@/components/ui/button";

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
  groupId: string | null;
  groupSize?: number;
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




export function TodaySnapshot({ state, week, streak, longestStreak, pace, groupId, groupSize }: Props) {
  const navigate = useNavigate();
  const copy = COPY[state];

  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const deltaX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  // iOS: when the keyboard collapses mid-tap the later click event dispatches at
  // stale screen coordinates and can land on another element (e.g. the home
  // composer's photo button, which opens the file picker). Navigate at touch
  // time instead, and only when the touch didn't move (not a scroll/swipe).
  const ctaTouch = useRef<{ x: number; y: number } | null>(null);

  const SLIDES = 2;

  const goToCheckIn = () => navigate({ to: "/check-in" });

  const onCtaTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    ctaTouch.current = { x: t.clientX, y: t.clientY };
  };

  const onCtaTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    const start = ctaTouch.current;
    ctaTouch.current = null;
    if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) < 12) {
      goToCheckIn();
    }
  };

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
    <section className="mx-4 mt-3 overflow-hidden rounded-[26px] border border-border/60 bg-card shadow-sm">
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
          style={{ maxHeight: index === 0 ? 400 : 0, visibility: index === 0 ? "visible" : "hidden" }}
          aria-hidden={index !== 0}
        >
          <WorkoutCard
            groupId={groupId}
            groupSize={groupSize}
            streak={streak}
            embedded
            fallback={
              <>
                <div
                  className={`flex flex-col px-5 pt-5 ${
                    copy.cta ? "min-h-[166px] pb-3" : "pb-6"
                  }`}
                >
                  <span className="text-[24px] font-black leading-none text-card-foreground">
                    {copy.title}
                  </span>
                  {copy.cta ? (
                    <div className="mt-8 flex flex-1 items-center gap-4">
                      <p className="min-w-0 flex-1 text-pretty text-[17px] font-medium leading-[1.3] text-muted-foreground">
                        {copy.message}
                      </p>
                      <Button
                        onClick={goToCheckIn}
                        onTouchStart={onCtaTouchStart}
                        onTouchEnd={onCtaTouchEnd}
                        className="h-12 shrink-0 rounded-full bg-pactara-purple px-6 text-[15px] font-bold text-pactara-purple-foreground shadow-none hover:bg-pactara-purple-deep active:scale-[0.99]"
                      >
                        {copy.cta}
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-4 text-pretty text-[17px] font-medium leading-[1.3] text-muted-foreground">
                      {copy.message}
                    </p>
                  )}
                </div>
              </>
            }
          />
        </div>

        {/* Slide 2 — Weekly snapshot */}
        <div
          className="w-full shrink-0 overflow-hidden"
          style={{ maxHeight: index === 1 ? 400 : 0, visibility: index === 1 ? "visible" : "hidden" }}
          aria-hidden={index !== 1}
        >
          <div className="min-h-[166px] px-5 pb-3 pt-5">
            <span className="text-[24px] font-black leading-none text-card-foreground">
              Weekly snapshot
            </span>
            <div className="mt-8">
            <div className="flex items-center justify-between">
              {stats.map((s, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center text-center">
                  <span className="text-[28px] font-black leading-none text-card-foreground">
                    {s.value}
                  </span>
                  <span className="mt-2 text-[11px] font-semibold uppercase text-muted-foreground">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            {pace && (
              <div className="mt-5 border-t border-border/60 pt-4">
                <div className="flex items-center justify-between text-[13px]">
                   <span className="font-semibold text-card-foreground">
                    Day {pace.dayNumber} of {pace.durationDays}
                  </span>
                  <span
                    className={pace.pacePct >= 100 ? "font-bold text-green-600" : pace.pacePct >= 80 ? "font-bold text-pactara-purple" : "font-bold text-orange-600"}
                  >
                    {pace.pacePct}% on pace
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={pace.pacePct >= 100 ? "h-full rounded-full bg-green-600 transition-all duration-300" : pace.pacePct >= 80 ? "h-full rounded-full bg-pactara-purple transition-all duration-300" : "h-full rounded-full bg-orange-600 transition-all duration-300"}
                    style={{ width: `${Math.min(100, pace.pacePct)}%` }}
                  />
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Carousel dots */}
      <div className="flex items-center justify-center gap-2 pb-4 pt-0">
        {Array.from({ length: SLIDES }).map((_, i) => (
          <Button
            key={i}
            variant="ghost"
            size="icon"
            onClick={() => setIndex(i)}
            className="h-6 w-6 rounded-full p-0 hover:bg-transparent"
            aria-label={`Go to slide ${i + 1}`}
          >
            <span className={i === index ? "h-1.5 w-5 rounded-full bg-pactara-purple transition-all duration-200" : "h-1.5 w-1.5 rounded-full bg-border transition-all duration-200"} />
          </Button>
        ))}
      </div>
    </section>
  );
}
