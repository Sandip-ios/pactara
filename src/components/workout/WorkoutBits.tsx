import { useState } from "react";
import type { LibraryExercise } from "@/lib/exercise-library";
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
  zoom = 1.4,
}: {
  name: string;
  primary: readonly string[];
  image: string | null;
  size?: number;
  radius?: number;
  zoom?: number;
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
        // RepDB images show the whole scene; zoom thumbnails ~1.4× so the figure fills the tile.
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          onError={() => setFailed(true)}
        />
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

