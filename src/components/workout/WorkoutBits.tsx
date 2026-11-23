import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useInstructions, type LibraryExercise } from "@/lib/exercise-library";
import { EQUIPMENT_LABEL, initials, mainTab, tabLabel, tintGroupFor, type TintGroup } from "@/lib/lift-rules";

export const FONT = "Inter, system-ui, sans-serif";

/** Workout screens palette (from the approved designs). */
export const W = {
  bg: "#F5F2EE",
  ink: "#141218",
  stone: "#57534E",
  stoneDark: "#44403C",
  muted: "#78716C",
  line: "#E7E3DE",
  divider: "#F0EDE9",
  chip: "#F4F2EF",
  purple: "#7C3AED",
  violet: "#6D28D9",
  violetText: "#5B21B6",
  violetDeep: "#4C1D95",
  tint: "#F5F0FF",
  tintRow: "#FBF9FF",
  lilac: "#C4B5FD",
  lilacSoft: "#EDE7FB",
  green: "#16A34A",
  greenSoft: "#E8F6EC",
  greenText: "#15803D",
  gold: "#FEF3C7",
  goldText: "#92400E",
  goldIcon: "#B45309",
  disabled: "#A8A29E",
  ring: "#D6D3D1",
} as const;

export const TINT: Record<TintGroup, { tint: string; ink: string }> = {
  CH: { tint: "#EDE7FB", ink: "#5B21B6" },
  SH: { tint: "#EEF2FF", ink: "#3730A3" },
  BK: { tint: "#E8F6EC", ink: "#166534" },
  LG: { tint: "#FEF9C3", ink: "#854D0E" },
  AR: { tint: "#FFF1E7", ink: "#9A3412" },
  CO: { tint: "#E0F2FE", ink: "#075985" },
  GL: { tint: "#FCE7F3", ink: "#9D174D" },
};

export const tintFor = (primary: readonly string[]) => TINT[tintGroupFor(primary)];

/** Start-pose thumbnail on a light muscle tint; initials when there's no picture. */
export function ExerciseThumb({
  name,
  primary,
  image,
  size = 48,
  radius = 14,
}: {
  name: string;
  primary: readonly string[];
  image: string | null;
  size?: number;
  radius?: number;
}) {
  const t = tintFor(primary);
  const [failed, setFailed] = useState(false);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius, background: t.tint, color: t.ink }}
      aria-hidden
    >
      {image && !failed ? (
        <img src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[13px] font-extrabold">{initials(name)}</span>
      )}
    </span>
  );
}

/** "SHOULDERS · DUMBBELL" */
export function exerciseKicker(ex: Pick<LibraryExercise, "primary" | "equipment">) {
  return `${tabLabel(mainTab(ex.primary)).toUpperCase()} · ${EQUIPMENT_LABEL[ex.equipment].toUpperCase()}`;
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors"
      style={{ background: on ? W.purple : "#D6D3D1" }}
    >
      <span
        className="absolute top-[3px] h-[26px] w-[26px] rounded-full bg-white shadow transition-all"
        style={{ left: on ? 23 : 3 }}
      />
    </button>
  );
}

/** Start and peak pictures cross-fading on a slow loop. */
export function PoseLoop({ start, peak, name, height = 220 }: { start: string | null; peak: string | null; name: string; height?: number }) {
  const [showPeak, setShowPeak] = useState(false);
  useEffect(() => {
    if (!peak) return;
    const t = window.setInterval(() => setShowPeak((v) => !v), 1200);
    return () => window.clearInterval(t);
  }, [peak]);
  return (
    <div className="relative w-full overflow-hidden rounded-[16px]" style={{ height, background: W.chip }}>
      {start && (
        <img src={start} alt={`${name}, start position`} className="absolute inset-0 h-full w-full object-contain transition-opacity duration-500" style={{ opacity: showPeak ? 0 : 1 }} />
      )}
      {peak && (
        <img src={peak} alt={`${name}, end position`} className="absolute inset-0 h-full w-full object-contain transition-opacity duration-500" style={{ opacity: showPeak ? 1 : 0 }} />
      )}
    </div>
  );
}

export function HowToSheet({ exercise, onClose }: { exercise: LibraryExercise | null; onClose: () => void }) {
  const { data: steps, isLoading } = useInstructions(exercise?.id ?? null);
  return (
    <Drawer open={!!exercise} onOpenChange={(o) => !o && onClose()} shouldScaleBackground={false}>
      <DrawerContent
        className="z-[120] max-h-[92dvh] rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]"
        style={{ fontFamily: FONT, color: W.ink }}
      >
        {exercise && (
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-4">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-bold tracking-[0.6px]" style={{ color: tintFor(exercise.primary).ink }}>
                {exerciseKicker(exercise)}
              </span>
              <DrawerTitle className="text-[22px] font-extrabold leading-tight tracking-tight">{exercise.name}</DrawerTitle>
              <DrawerDescription className="sr-only">How to do {exercise.name}</DrawerDescription>
            </div>
            <PoseLoop start={exercise.imageStart} peak={exercise.imagePeak} name={exercise.name} />
            {isLoading ? (
              <div className="h-24 animate-pulse rounded-[16px]" style={{ background: W.chip }} />
            ) : steps && steps.length ? (
              <ol className="flex flex-col gap-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-snug">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold"
                      style={{ background: W.tint, color: W.violetText }}
                    >
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[14px]" style={{ color: W.stone }}>
                No steps for this exercise yet.
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-12 w-full shrink-0 rounded-full bg-white text-[15px] font-bold"
              style={{ border: `1.5px solid ${W.line}`, color: W.ink }}
            >
              Close
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
