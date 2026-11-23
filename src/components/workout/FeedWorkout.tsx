import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Dumbbell, Plus, Trophy } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { FeedAvatar } from "@/components/feed/FeedMedia";
import { getWorkoutDetail, type WorkoutDetail } from "@/lib/lifts.functions";
import { saveCrewWorkout } from "@/lib/workout-share.functions";
import { firstNameOf } from "@/lib/workout-share";
import { MY_WORKOUTS_KEY } from "@/lib/exercise-library";
import { showSavedToast, showTopError } from "./savedToast";
import type { FeedWorkout } from "@/lib/daily-posts.functions";
import { convertWeight, fmtDurationShort, fmtNum, repsLabel, summaryLine, type WeightUnit } from "@/lib/lift-rules";
import { ExerciseThumb, FONT, W } from "./WorkoutBits";

/** Under the media on a logged-workout post; opens the read-only workout. */
export type PostAuthor = { name: string; avatarUrl: string | null; avatarColor: string };

export function WorkoutSummaryRow({ workout, checkInId, author }: { workout: FeedWorkout; checkInId: string; author: PostAuthor | null }) {
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
      {open && <WorkoutDetailSheet checkInId={checkInId} title={workout.title} author={author} onClose={() => setOpen(false)} />}
    </>
  );
}

function WorkoutDetailSheet({
  checkInId,
  title,
  author,
  onClose,
}: {
  checkInId: string;
  title: string | null;
  /** Someone else's post (null on your own: no Save). */
  author: PostAuthor | null;
  onClose: () => void;
}) {
  const fetchFn = useServerFn(getWorkoutDetail);
  const saveFn = useServerFn(saveCrewWorkout);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const queryKey = ["workout-detail", checkInId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchFn({ data: { checkInId } }),
    staleTime: 60_000,
  });
  const [saving, setSaving] = useState(false);
  const unit: WeightUnit = data?.summary?.unit ?? "lb";
  const canSave = !!author && !!data && !data.isMine && data.exercises.length > 0;
  const saved = !!data?.savedWorkoutId;

  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const res = await saveFn({ data: { checkInId } });
      qc.setQueryData<WorkoutDetail | null>(queryKey, (d) => (d ? { ...d, savedWorkoutId: res.workoutId } : d));
      void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
      showSavedToast(res.name);
    } catch (e) {
      console.error("[workout] save from feed failed", e);
      showTopError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[88dvh] rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]" style={{ fontFamily: FONT, color: W.ink }}>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pt-4">
          {author && !data?.isMine && (
            <div className="flex items-center gap-2.5">
              <FeedAvatar url={author.avatarUrl} color={author.avatarColor || "#22C55E"} name={author.name} size={32} />
              <span className="min-w-0 truncate text-[13px]" style={{ color: W.stone }}>
                <span className="font-bold" style={{ color: W.ink }}>
                  {firstNameOf(author.name)}
                </span>
                {data?.dayLabel ? ` · ${data.dayLabel}` : ""}
              </span>
            </div>
          )}
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
          {canSave && (
            <div className="flex flex-col gap-3 pt-1">
              <p className="text-center text-[12px]" style={{ color: W.muted }}>
                {saved ? "Saved with sets and 8–12 reps. Your weights fill in from your own history." : "Your weights fill in from your own history."}
              </p>
              {saved ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    void navigate({ to: "/workouts" });
                  }}
                  className="flex h-[52px] w-full shrink-0 items-center justify-center gap-2 rounded-[26px] text-[16px] font-bold"
                  style={{ background: W.lilacSoft, color: W.violetText }}
                >
                  <Check size={18} aria-hidden /> Saved · Open in Workouts
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="flex h-[52px] w-full shrink-0 items-center justify-center gap-2 rounded-[26px] text-[16px] font-bold text-white disabled:opacity-70"
                  style={{ background: W.purple }}
                >
                  <Plus size={18} aria-hidden /> {saving ? "Saving…" : "Save to my workouts"}
                </button>
              )}
            </div>
          )}
          <button type="button" onClick={onClose} className="h-12 w-full shrink-0 rounded-full bg-white text-[15px] font-bold" style={{ border: `1.5px solid ${W.line}` }}>
            Close
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
