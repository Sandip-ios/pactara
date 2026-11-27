import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getDiscoverWorkout, saveDiscoverWorkout } from "@/lib/discover-page.functions";
import { MY_WORKOUTS_KEY } from "@/lib/exercise-library";
import type { DiscoverCard } from "@/lib/discover-workouts";
import { NewSheet, NewSheetButton } from "./NewSheet";
import { DiscoverError, DiscoverImage } from "./DiscoverBits";
import { newToast } from "./new-toast";
export function DiscoverWorkoutSheet({
  card,
  onClose,
}: {
  card: DiscoverCard;
  onClose: () => void;
}) {
  const fetchFn = useServerFn(getDiscoverWorkout);
  const save = useServerFn(saveDiscoverWorkout);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(!!card.myCopyId);
  const page = useQuery({
    queryKey: ["discover-workout", card.code],
    queryFn: () => fetchFn({ data: { code: card.code } }),
    staleTime: 0,
  });
  return (
    <NewSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={card.name}
      subtitle={`by ${card.author}`}
    >
      <div className="redesign-step3">
        <p className="p5-meta">
          {card.exercises} {card.exercises === 1 ? "exercise" : "exercises"} · {card.minutes} min
        </p>
        {page.isError ? (
          <DiscoverError kind="workouts" retry={() => void page.refetch()} />
        ) : page.isPending ? (
          <div className="p5-skeleton h-32 animate-pulse" />
        ) : !page.data ? (
          <p className="p5-meta">That workout isn't available anymore.</p>
        ) : (
          page.data.exercises.map((e, i) => (
            <div
              key={`${e.exerciseId}-${i}`}
              className="flex items-center gap-3 border-b border-[var(--new-divider)] py-3"
            >
              <DiscoverImage url={e.imageStart} className="h-11 w-11 rounded-[10px]" />
              <span>
                <strong className="text-[15px]">{e.name}</strong>
                <small className="p5-small block">
                  {e.sets} sets
                  {e.reps
                    ? ` · ${e.reps}`
                    : e.repsTarget
                      ? ` · ${e.repsTarget} reps`
                      : e.secondsTarget
                        ? ` · ${e.secondsTarget} sec`
                        : ""}
                </small>
              </span>
            </div>
          ))
        )}
        <NewSheetButton
          disabled={busy || saved || !page.data}
          onClick={() => {
            if (busy) return;
            setBusy(true);
            void save({ data: { code: card.code } })
              .then(async (res) => {
                if (res.status === "saved") {
                  setSaved(true);
                  await qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
                  await qc.invalidateQueries({ queryKey: ["discover-workouts"] });
                  await qc.invalidateQueries({ queryKey: ["discover-search"] });
                } else newToast("That workout isn't available anymore.");
              })
              .catch(() => newToast("Couldn't save. Try again."))
              .finally(() => setBusy(false));
          }}
        >
          {saved ? "Added to my workouts" : "Add to my workouts"}
        </NewSheetButton>
        <Button variant="ghost" className="p5-link mt-2 w-full h-11" onClick={onClose}>
          Close
        </Button>
      </div>
    </NewSheet>
  );
}
