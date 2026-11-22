import { ChevronDown, Flame } from "lucide-react";
import { streakChipLabel } from "@/lib/crew-today";

const PURPLE = "#7C3AED";

/** Group switcher, challenge progress, crew streak and the weekly rule. */
export function CrewBar({
  label,
  icon,
  canSwitch,
  onOpenSwitcher,
  dayNumber,
  durationDays,
  streak,
  solo,
  weeklyTarget,
}: {
  label: string;
  icon: string | null | undefined;
  canSwitch: boolean;
  onOpenSwitcher: () => void;
  dayNumber: number;
  durationDays: number;
  streak: number;
  solo: boolean;
  weeklyTarget: number;
}) {
  const pct = Math.min(100, Math.max(0, (dayNumber / Math.max(1, durationDays)) * 100));
  return (
    <section className="flex flex-col gap-3 border-b border-neutral-200 bg-white p-4">
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        {canSwitch ? (
          <button
            type="button"
            onClick={onOpenSwitcher}
            aria-label={`Switch group, current: ${label}`}
            className="flex min-h-[44px] min-w-0 items-center gap-1.5 text-[15px] font-bold text-neutral-900 active:opacity-70"
          >
            {icon && <span>{icon}</span>}
            <span className="max-w-[200px] truncate">{label}</span>
            <ChevronDown size={16} className="shrink-0 text-neutral-500" />
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold text-neutral-900">
            {icon && <span>{icon}</span>}
            <span className="max-w-[220px] truncate">{label}</span>
          </div>
        )}
        <span className="shrink-0 text-[13px] text-neutral-500">
          Day {dayNumber} of {durationDays}
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "#EDE6FE" }}
        role="progressbar"
        aria-label={`Day ${dayNumber} of ${durationDays}`}
        aria-valuemin={0}
        aria-valuemax={durationDays}
        aria-valuenow={dayNumber}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PURPLE }} />
      </div>

      {/* One line only: when the helper text doesn't fit next to a long chip it
          wraps onto a second line that this fixed-height row clips away. */}
      <div className="flex h-7 flex-wrap content-start items-center gap-x-2 overflow-hidden">
        <span
          className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-bold"
          style={{ background: "#FFF1E7", color: "#9A3412" }}
        >
          <Flame size={14} style={{ color: "#EA580C" }} fill="#EA580C" />
          {streakChipLabel(streak, solo)}
        </span>
        <span className="whitespace-nowrap text-[13px] leading-7 text-neutral-500">Rest days are automatic</span>
      </div>

      <p className="text-[13px] text-neutral-700">
        Crew rule: <span className="font-bold text-neutral-900">{weeklyTarget} {weeklyTarget === 1 ? "check-in" : "check-ins"} a week</span>, any activity
      </p>
    </section>
  );
}

export function CrewBarSkeleton() {
  return (
    <section className="flex flex-col gap-3 border-b border-neutral-200 bg-white p-4" aria-hidden>
      <div className="flex h-[44px] items-center justify-between">
        <div className="h-5 w-40 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-4 w-20 animate-pulse rounded-md bg-neutral-200" />
      </div>
      <div className="h-1.5 w-full animate-pulse rounded-full bg-neutral-200" />
      <div className="flex items-center gap-2">
        <div className="h-7 w-36 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-4 w-32 animate-pulse rounded-md bg-neutral-200" />
      </div>
      <div className="h-4 w-56 animate-pulse rounded-md bg-neutral-200" />
    </section>
  );
}
