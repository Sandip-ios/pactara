import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useExerciseMap, useLiftHistory } from "@/lib/exercise-library";
import { convertWeight, fmtDurationShort, fmtNum, plural } from "@/lib/lift-rules";
import { ExerciseThumb, W } from "./WorkoutBits";

const SHOW = 4;

/** Own profile: exercises you've logged, most recent first, each opening its progress. */
export function ProfileLifts() {
  const navigate = useNavigate();
  const { data } = useLiftHistory();
  const { map } = useExerciseMap();
  const [all, setAll] = useState(false);
  if (!data) return null;
  const ids = Object.entries(data.byExercise)
    .sort((a, b) => b[1].lastDoneAt.localeCompare(a[1].lastDoneAt))
    .map(([id]) => id)
    .filter((id) => map.has(id));
  if (ids.length === 0) return null;
  const shown = all ? ids : ids.slice(0, SHOW);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl" style={{ background: "#FAF8F6" }}>
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: W.violet }}>
          Lifts
        </span>
        <span className="text-[12px]" style={{ color: W.muted }}>
          {plural(ids.length, "exercise")}
        </span>
      </div>
      {shown.map((id, i) => {
        const ex = map.get(id)!;
        const h = data.byExercise[id]!;
        const timed = ex.logType === "timed";
        const best = timed
          ? (() => {
              const s = Math.max(0, ...h.last.sets.map((x) => x.seconds ?? 0));
              return s ? `Last ${fmtDurationShort(s)}` : "Logged";
            })()
          : h.best?.weight
            ? `Best ${fmtNum(convertWeight(h.best.weight, h.best.unit, data.unit))} ${data.unit} × ${h.best.reps ?? 0}`
            : h.best?.reps
              ? `Best ${h.best.reps} reps`
              : "Logged";
        return (
          <button
            key={id}
            type="button"
            onClick={() => navigate({ to: "/exercises/$exerciseId", params: { exerciseId: id } })}
            className="flex min-h-[56px] w-full items-center gap-3 px-3 py-2 text-left"
            style={{ borderTop: i ? `1px solid ${W.divider}` : undefined }}
          >
            <ExerciseThumb name={ex.name} primary={ex.primary} image={ex.imageStart} size={36} radius={10} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{ex.name}</span>
              <span className="block truncate text-[12px]" style={{ color: W.stone }}>
                {best} · {plural(h.sessions, "session")}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-neutral-400" />
          </button>
        );
      })}
      {ids.length > SHOW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="h-11 w-full text-[13px] font-semibold" style={{ color: W.violet, borderTop: `1px solid ${W.divider}` }}>
          {all ? "Show less" : `Show all ${ids.length}`}
        </button>
      )}
    </div>
  );
}
