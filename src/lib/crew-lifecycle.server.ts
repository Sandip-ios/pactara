import type { SupabaseClient } from "@supabase/supabase-js";

/** Membership alone is not permission to use an ended crew. */
export async function requireActiveCrew(supabase: SupabaseClient, groupId: string): Promise<void> {
  const { data, error } = await supabase.from("groups").select("id").eq("id", groupId).is("ended_at", null).maybeSingle();
  if (error) throw new Error("Could not check crew availability");
  if (!data) throw new Error("This crew has ended or is no longer available");
}