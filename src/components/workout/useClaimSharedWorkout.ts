import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { saveSharedWorkout } from "@/lib/workout-share.functions";
import { clearPendingSharedWorkout, getPendingSharedWorkout } from "@/lib/pending-shared-workout";
import { MY_WORKOUTS_KEY } from "@/lib/exercise-library";
import { showSavedToast } from "./savedToast";
import { useAppVersion } from "@/hooks/use-app-version";

let claiming = false;

/**
 * A shared-workout link opened while signed out: once the member reaches
 * Home (after signup, onboarding and the paywall, or after signing in),
 * save it and open it in Edit workout.
 */
export function useClaimSharedWorkout() {
  const version = useAppVersion();
  const saveFn = useServerFn(saveSharedWorkout);
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    const code = getPendingSharedWorkout();
    if (!code || claiming) return;
    claiming = true;
    void (async () => {
      try {
        const res = await saveFn({ data: { code } });
        clearPendingSharedWorkout();
        if (res.status === "missing") return;
        void qc.invalidateQueries({ queryKey: MY_WORKOUTS_KEY });
        if (res.status === "saved") showSavedToast(res.name, version);
        void navigate({ href: res.workoutId ? `/workouts?edit=${res.workoutId}` : "/workouts" });
      } catch (e) {
        // Offline or a hiccup: keep the code and try again next time Home opens.
        console.warn("[shared] saving the pending workout failed", e);
      } finally {
        claiming = false;
      }
    })();
  }, [saveFn, navigate, qc, version]);
}
