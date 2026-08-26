import { useNavigate } from "@tanstack/react-router";

const PURPLE = "#7C3AED";

export type SnapshotState = "ritual" | "check-in" | "done";

type Props = {
  state: SnapshotState;
};

const COPY: Record<
  SnapshotState,
  { title: string; message: string; cta: string | null }
> = {
  ritual: {
    title: "Morning commitment",
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

export function TodaySnapshot({ state }: Props) {
  const navigate = useNavigate();
  const copy = COPY[state];

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-white shadow-sm overflow-hidden">
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
  );
}
