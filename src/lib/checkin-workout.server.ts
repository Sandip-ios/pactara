import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeCheckInSocial } from "./home-checkin.functions";

/** The existing Home RPC checks crew/follower visibility and blocks before privileged linkage reads. */
export async function visibleCheckInWorkout(supabase: SupabaseClient, checkInId: string) {
  const { data, error } = await supabase.rpc("get_home_checkin_social", { _id: checkInId });
  const detail = (data as HomeCheckInSocial | null)?.workoutDetail;
  if (error || !detail || !detail.exercises.length) throw new Error("That workout isn't available");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: checkIn } = await supabaseAdmin.from("check_ins").select("user_id, groups(name)").eq("id", checkInId).maybeSingle();
  if (!checkIn) throw new Error("That workout isn't available");
  const { data: session } = await supabaseAdmin.from("workout_sessions").select("id")
    .eq("user_id", checkIn.user_id).contains("check_in_ids", [checkInId]).not("logged_at", "is", null).limit(1).maybeSingle();
  if (!session) throw new Error("That workout isn't available");
  return { detail, sessionId: session.id, authorId: checkIn.user_id, crewName: checkIn.groups?.name ?? null };
}