import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dumbbell, Trophy } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { getWorkoutDetail } from "@/lib/lifts.functions";
import type { FeedWorkout } from "@/lib/daily-posts.functions";
import { convertWeight, fmtDurationShort, fmtNum, repsLabel, summaryLine, type WeightUnit } from "@/lib/lift-rules";
import { ExerciseThumb, FONT, W } from "./WorkoutBits";

/** Under the media on a logged-workout post; opens the read-only workout. */
export function WorkoutSummaryRow({ workout, checkInId }: { workout: FeedWorkout; checkInId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex px-4 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${workout.title ?? "Workout"}: ${summaryLine(workout)}${workout.pr ? `. New PR: ${workout.pr}` : ""}. Show the workout`}
          className="flex min-h-7 max-w-full flex-wrap items-center gap-x-2 gap-y-1.5 text-left"
        >
          <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: W.stoneDark }}>
            <Dumbbell size={14} className="shrink-0" aria-hidden />
            {summaryLine(workout)}
          </span>
          {workout.pr && (
            <span className="inline-flex h-7 min-w-0 max-w-full items-center gap-1 rounded-full px-2.5 text-[12px] font-extrabold" style={{ background: W.gold, color: W.goldText }}>
              <Trophy size={12} className="shrink-0" aria-hidden />
              <span className="truncate">New PR: {workout.pr}</span>
            </span>
          )}
        </button>
      </div>
      {open && <WorkoutDetailSheet checkInId={checkInId} title={workout.title} onClose={() => setOpen(false)} />}
    </>
  );
}

function WorkoutDetailSheet({ checkInId, title, onClose }: { checkInId: string; title: string | null; onClose: () => void }) {
  const fetchFn = useServerFn(getWorkoutDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["workout-detail", checkInId],
    queryFn: () => fetchFn({ data: { checkInId } }),
    staleTime: 60_000,
  });
  const unit: WeightUnit = data?.summary?.unit ?? "lb";
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[88dvh] rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]" style={{ fontFamily: FONT, color: W.ink }}>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pt-4">
          <div>
            <DrawerTitle className="text-[20px] font-extrabold leading-tight">{data?.title ?? title ?? "Workout"}</DrawerTitle>
            <DrawerDescription className="text-[13px]" style={{ color: W.stone }}>
              {data?.summary ? summaryLine(data.summary) : "Exercises and sets"}
            </DrawerDescription>
          </div>
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-[16px]" style={{ background: W.chip }} />
          ) : !data ? (
            <p className="text-[14px]" style={{ color: W.stone }}>
              This workout isn't available.
            </p>
          ) : (
            <ul className="rounded-[16px]" style={{ border: `1.5px solid ${W.line}` }}>
              {data.exercises.map((e, i) => (
                <li key={`${e.exerciseId}-${i}`} className="flex gap-3 p-3" style={{ borderTop: i ? `1px solid ${W.line}` : undefined }}>
                  <ExerciseThumb name={e.name} primary={[]} image={e.imageStart} size={44} radius={12} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold">{e.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-[13px]" style={{ color: W.stone, fontVariantNumeric: "tabular-nums" }}>
                      {e.sets.map((s, j) => (
                        <span key={j} className={s.isPr ? "font-extrabold" : undefined} style={s.isPr ? { color: W.goldText } : undefined}>
                          {e.logType === "timed"
                            ? fmtDurationShort(s.seconds ?? 0)
                            : s.weight
                              ? `${fmtNum(convertWeight(s.weight, s.unit, unit))} × ${s.reps ?? 0}`
                              : repsLabel(s.reps ?? 0)}
                          {s.isPr ? " 🏆" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={onClose} className="h-12 w-full shrink-0 rounded-full bg-white text-[15px] font-bold" style={{ border: `1.5px solid ${W.line}` }}>
            Close
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
