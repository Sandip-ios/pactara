import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getWorkoutState,
  finishWorkout,
  endWorkoutWithoutCompleting,
} from "@/lib/workouts.functions";
import { elapsedLabel, LiveDot } from "@/components/groups/AccountabilityBits";
import { trackWorkout } from "@/lib/workout-analytics";

/**
 * The accountability moment before the proof.
 *
 * Home shows a plain "Check in" button (the fallback). Starting a workout from
 * Home was retired; this only renders a still-running session (Record proof /
 * Finish workout) until it finishes or expires.
 */

/** Commitments like "100 pushups • Shoulders and arms" render as stacked bullet lines. */
function CommitmentLines({ text }: { text: string }) {
  const parts = text
    .split(/\s*•\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return <>{text}</>;
  return (
    <span className="flex flex-col gap-1.5">
      {parts.map((p, i) => (
        <span key={i} className="flex gap-2">
          <span className="text-muted-foreground">•</span>
          <span>{p}</span>
        </span>
      ))}
    </span>
  );
}

export function WorkoutCard({
  groupId,
  streak,
  embedded = false,
  fallback = null,
}: {
  groupId: string | null;
  groupSize?: number;
  streak?: number;
  embedded?: boolean;
  fallback?: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [needsProof, setNeedsProof] = useState(false);
  const [completed, setCompleted] = useState<{ minutes: number } | null>(null);

  const { data } = useQuery({
    queryKey: ["workout-state", groupId],
    queryFn: () => getWorkoutState({ data: { groupId } }),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const finishFn = useServerFn(finishWorkout);
  const endFn = useServerFn(endWorkoutWithoutCompleting);

  const session = data?.session ?? null;

  // Keep the "Started N min ago" line honest without a workout timer.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!session) return;
    const t = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [session]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["workout-state"] });
    queryClient.invalidateQueries({ queryKey: ["groups-today"] });
  };

  const finish = useMutation({
    mutationFn: (sessionId: string) => finishFn({ data: { sessionId } }),
    onSuccess: (res, sessionId) => {
      if (res.needsProof) {
        setNeedsProof(true);
        return;
      }
      setNeedsProof(false);
      setCompleted({ minutes: Math.max(1, Math.round((res.durationSeconds ?? 0) / 60)) });
      refresh();
      trackWorkout("workout_completed", {
        group_id: groupId,
        session_id: sessionId,
        session_duration: res.durationSeconds,
        proof_completed: true,
        current_streak: streak,
      });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't finish that workout"),
  });

  const end = useMutation({
    mutationFn: (sessionId: string) => endFn({ data: { sessionId } }),
    onSuccess: (res, sessionId) => {
      setNeedsProof(false);
      refresh();
      trackWorkout("workout_ended_without_completion", {
        group_id: groupId,
        session_id: sessionId,
        session_duration: res.durationSeconds,
        proof_completed: false,
      });
      toast("Workout ended — you can still check in today");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't end that workout"),
  });

  const recordProof = (sessionId: string | null) => {
    trackWorkout("workout_proof_started", { group_id: groupId, session_id: sessionId });
    setNeedsProof(false);
    navigate({ to: "/check-in" });
  };

  if (completed) {
    return (
      <div className={embedded ? "flex min-h-[166px] flex-col items-center justify-center px-5 py-5 text-center" : "mx-4 mt-3 rounded-2xl bg-card px-5 py-5 text-center shadow-sm"}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <Check size={24} strokeWidth={3} className="text-green-600" />
        </div>
        <div className="mt-3 text-[18px] font-black tracking-tight">Workout complete</div>
        <div className="mt-1 text-[14px] text-muted-foreground">
          You showed up. {completed.minutes} min.
        </div>
        {(streak ?? 0) > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3.5 py-1.5 text-[13px] font-bold text-orange-600">
            🔥 {streak} day streak
          </div>
        )}
      </div>
    );
  }

  if (session) {
    return (
      <>
        <div className={embedded ? "overflow-hidden" : "mx-4 mt-3 overflow-hidden rounded-2xl bg-card shadow-sm"}>
          <div className="flex min-h-[166px] flex-col border-t-[3px] border-green-600 px-5 pb-3 pt-4">
            <div className="flex items-center gap-2">
              <LiveDot />
              <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-green-600">
                Workout in progress
              </span>
            </div>
            <div className="mt-2 flex-1 break-words text-pretty text-[20px] font-black leading-[1.18] text-card-foreground">
              <CommitmentLines text={session.commitmentText || "Today's workout"} />
            </div>
            <div className="mt-1 text-[14px] text-muted-foreground">
              {elapsedLabel(session.startedAt) ?? "Started just now"}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                onClick={() => recordProof(session.id)}
                className="h-12 min-w-0 flex-1 rounded-full bg-pactara-purple text-[14px] font-bold text-pactara-purple-foreground shadow-none hover:bg-pactara-purple-deep active:scale-[0.98]"
              >
                <Camera size={16} />
                Record proof
              </Button>
              <Button
                onClick={() => {
                  trackWorkout("workout_finish_started", {
                    group_id: groupId,
                    session_id: session.id,
                  });
                  finish.mutate(session.id);
                }}
                disabled={finish.isPending}
                className="h-12 min-w-0 flex-1 rounded-full bg-pactara-purple-soft px-3 text-[14px] font-bold text-pactara-purple shadow-none hover:bg-pactara-purple-soft active:scale-[0.98]"
              >
                {finish.isPending ? "Checking…" : "Finish workout"}
              </Button>
            </div>
          </div>
        </div>

        {needsProof && (
          <div
            className="fixed inset-0 z-[70] flex items-end bg-black/40"
            onClick={() => setNeedsProof(false)}
          >
            <div
              className="w-full rounded-t-3xl bg-white px-5 pt-6"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[20px] font-black tracking-tight">One last thing</div>
              <div className="mt-1.5 text-[15px] text-neutral-500">
                Add proof that you showed up before finishing.
              </div>
              <Button
                onClick={() => recordProof(session.id)}
                className="mt-5 h-12 w-full rounded-full bg-pactara-purple text-[15px] font-bold text-pactara-purple-foreground shadow-none hover:bg-pactara-purple-deep active:scale-[0.99]"
              >
                Record proof
              </Button>
              <Button
                variant="ghost"
                onClick={() => end.mutate(session.id)}
                disabled={end.isPending}
                className="mt-2 h-12 w-full rounded-full text-[14px] font-semibold text-muted-foreground"
              >
                End workout without completing
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  return <>{fallback}</>;
}
