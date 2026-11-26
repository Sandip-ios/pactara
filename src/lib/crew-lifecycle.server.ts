import type { SupabaseClient } from "@supabase/supabase-js";

/** Membership alone is not permission to use an ended crew. */
export async function requireActiveCrew(supabase: SupabaseClient, groupId: string): Promise<void> {
  const { data, error } = await supabase.from("groups").select("id").eq("id", groupId).is("ended_at", null).maybeSingle();
  if (error) throw new Error("Could not check crew availability");
  if (!data) throw new Error("This crew has ended or is no longer available");
}

/** Check the parent before reading or signing comment media by a post ID. */
export async function requireActivePost(supabase: SupabaseClient, postId: string): Promise<void> {
  const { data, error } = await supabase.from("daily_posts")
    .select("id, groups!inner(ended_at)").eq("id", postId)
    .is("groups.ended_at", null).maybeSingle();
  if (error) throw new Error("Could not check crew availability");
  if (!data) throw new Error("This crew has ended or is no longer available");
}