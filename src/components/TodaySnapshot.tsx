import { useNavigate } from "@tanstack/react-router";

const PURPLE = "#7C3AED";

export type SnapshotState = "ritual" | "check-in" | "done";

type Props = {
  state: SnapshotState;
  streak: number;
  weekDone: number;
  weekTotal: number;
};

const COPY: Record<
  SnapshotState,
  { eyebrow: string; message: string; cta: string | null }
> = {
  ritual: {
    eyebrow: "Your morning",
    message: "Set your commitment for today so your group knows the plan.",
    cta: "Commit now",
  },
  "check-in": {
    eyebrow: "Your check-in",
    message: "Morning's done — check in and keep your streak alive.",
    cta: "Check in",
  },
  done: {
    eyebrow: "Today",
    message: "You're all set for today. Nice work.",
    cta: null,
  },
};

export function TodaySnapshot({ state, streak, weekDone, weekTotal }: Props) {
  const navigate = useNavigate();
  const copy = COPY[state];

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-[15px] font-bold text-neutral-900">{copy.eyebrow}</span>
        <span className="text-[13px] font-semibold text-neutral-400">
          {weekDone}/{weekTotal} this week
        </span>
      </div>

      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex shrink-0 flex-col items-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-black"
            style={{
              background: streak > 0 ? "#EDE6FE" : "#F1F0EE",
              color: streak > 0 ? PURPLE : "#A3A3A3",
            }}
          >
            {streak}
          </div>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
            {streak === 1 ? "Day" : "Days"}
          </span>
        </div>

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
  );
}
