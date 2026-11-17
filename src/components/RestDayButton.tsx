import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Moon } from "lucide-react";
import { getRestDayInfo, takeRestDay } from "@/lib/rest-days.functions";

/**
 * "Take a rest day" lives on Home's today card (it used to sit on the
 * morning-commitment screen, which no longer exists).
 */
export function RestDayButton() {
  const queryClient = useQueryClient();
  const fetchRest = useServerFn(getRestDayInfo);
  const takeFn = useServerFn(takeRestDay);
  const { data: rest } = useQuery({
    queryKey: ["rest-day-info"],
    queryFn: () => fetchRest(),
    staleTime: 30_000,
  });
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => takeFn(),
    onSuccess: () => {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["rest-day-info"] });
      queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["group-feed"] });
      queryClient.invalidateQueries({ queryKey: ["group-today"] });
      queryClient.invalidateQueries({ queryKey: ["groups-today"] });
      queryClient.invalidateQueries({ queryKey: ["group-member-streaks"] });
    },
  });
  if (!rest || rest.checkedInToday || rest.restingToday) return null;
  const none = rest.remaining <= 0;

  if (!confirming) {
    return (
      <div className="flex justify-center px-5 pb-2">
        <button
          type="button"
          disabled={none}
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-pactara-purple disabled:opacity-50"
        >
          <Moon size={14} />
          {none ? "No rest days left this week" : `Take a rest day · ${rest.remaining} left this week`}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-5 mb-3 rounded-2xl bg-secondary p-4">
      <div className="font-bold text-card-foreground">Take today off?</div>
      <p className="mt-1 text-[14px] text-muted-foreground">
        Your streak stays alive and your group sees you're resting. You get {rest.limit} rest days a week.
      </p>
      {mutation.error && (
        <p className="mt-2 text-[13px] text-destructive">{(mutation.error as Error).message}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-xl bg-card py-2.5 text-[14px] font-semibold text-card-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="flex-1 rounded-xl bg-pactara-purple py-2.5 text-[14px] font-semibold text-pactara-purple-foreground"
        >
          {mutation.isPending ? "Saving…" : "Rest today"}
        </button>
      </div>
    </div>
  );
}
