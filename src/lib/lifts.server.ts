import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * After a check-in posts: attach it to the logged workout it came from, so
 * the post shows the workout summary. Runs as the signed-in user (own rows).
 */
export async function linkWorkoutToCheckIns(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  checkInIds: string[],
): Promise<boolean> {
  if (!checkInIds.length) return false;
  const { data: row } = await supabase
    .from("workout_sessions")
    .select("id, check_in_ids, logged_at, workout_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row || !row.logged_at) return false;
  const ids = Array.from(new Set([...(row.check_in_ids ?? []), ...checkInIds]));
  const { error } = await supabase
    .from("workout_sessions")
    .update({ check_in_ids: ids, status: "completed", proof_completed: true })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) {
    console.error("[lifts] link check-in failed", error);
    return false;
  }
  return true;
}
