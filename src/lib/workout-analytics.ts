import posthog from "posthog-js";

/**
 * Analytics for the Start workout loop. Kept in one place so every event
 * carries the same property shape and the funnel stays answerable:
 * start rate, completion rate with vs. without a start, notification opens,
 * cheer rate, and time from start → proof → complete.
 */
export type WorkoutEvent =
  | "workout_start_viewed"
  | "workout_started"
  | "workout_start_notification_sent"
  | "workout_start_notification_opened"
  | "workout_cheer_sent"
  | "workout_proof_started"
  | "workout_proof_completed"
  | "workout_finish_started"
  | "workout_completed"
  | "workout_ended_without_completion"
  | "workout_restarted";

export type WorkoutEventProps = {
  group_id?: string | null;
  commitment_id?: string | null;
  session_id?: string | null;
  group_size?: number | null;
  active_group_size?: number | null;
  current_streak?: number | null;
  session_duration?: number | null;
  proof_completed?: boolean | null;
  notification_sent?: boolean | null;
  notification_opened?: boolean | null;
  emoji?: string | null;
};

export function trackWorkout(event: WorkoutEvent, props: WorkoutEventProps = {}) {
  try {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined && value !== null) clean[key] = value;
    }
    posthog.capture(event, clean);
  } catch {
    // Analytics must never break the workout flow.
  }
}
