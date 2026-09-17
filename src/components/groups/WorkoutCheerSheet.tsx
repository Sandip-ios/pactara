import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cheerWorkout, getWorkoutSession } from "@/lib/workouts.functions";
import { MemberAvatar, LiveDot, elapsedLabel } from "@/components/groups/AccountabilityBits";
import { trackWorkout } from "@/lib/workout-analytics";

const CHEERS = ["🔥", "💪", "👏"] as const;

/**
 * Quick cheers for a groupmate mid-workout. Opened from the group page or
 * straight from the "started" push, which deep links to the exact session.
 */
export function WorkoutCheerSheet({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["workout-session", sessionId],
    queryFn: () => getWorkoutSession({ data: { sessionId } }),
  });
  const cheerFn = useServerFn(cheerWorkout);

  useEffect(() => {
    trackWorkout("workout_start_notification_opened", { session_id: sessionId });
  }, [sessionId]);

  const cheer = useMutation({
    mutationFn: (emoji: string) => cheerFn({ data: { sessionId, emoji } }),
    onSuccess: (res, emoji) => {
      queryClient.invalidateQueries({ queryKey: ["workout-session", sessionId] });
      if (!res.alreadyCheered) {
        trackWorkout("workout_cheer_sent", { session_id: sessionId, emoji });
      }
      onClose();
      toast.success(`${emoji} sent`);
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't send that cheer"),
  });

  const member = data?.member;
  const session = data?.session;
  const isLive = session?.status === "active";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl bg-white px-5 pt-6 text-center"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {member && (
          <div className="flex justify-center">
            <MemberAvatar member={member} size={64} />
          </div>
        )}
        <div className="mt-3 text-[20px] font-black tracking-tight">
          {member ? `${member.firstName} is working out` : "Working out"}
        </div>
        {isLive ? (
          <div className="mt-1 flex items-center justify-center gap-2 text-[14px] font-semibold text-green-600">
            <LiveDot />
            {elapsedLabel(session?.startedAt ?? null) ?? "Started just now"}
          </div>
        ) : (
          <div className="mt-1 text-[14px] text-neutral-500">This session has wrapped up.</div>
        )}
        {session?.commitmentText && (
          <div className="mt-2 text-[14px] text-neutral-500">{session.commitmentText}</div>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          {CHEERS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => cheer.mutate(emoji)}
              disabled={cheer.isPending}
              className="h-16 w-16 rounded-full bg-[#F4F1ED] text-[28px] active:scale-95 disabled:opacity-60"
            >
              {emoji}
            </button>
          ))}
        </div>
        {(data?.cheerCount ?? 0) > 0 && (
          <div className="mt-3 text-[13px] text-neutral-400">
            {data?.cheerCount} {data?.cheerCount === 1 ? "cheer" : "cheers"} so far
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-full py-3.5 text-[14px] font-semibold text-neutral-500"
        >
          Close
        </button>
      </div>
    </div>
  );
}
