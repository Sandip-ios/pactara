import type { SupabaseClient } from "@supabase/supabase-js";
import { toCard, type FeedRow, type ExerciseFacts } from "./discover-workouts";
export async function loadDiscoverCards(supabase: SupabaseClient) {
  const { data: rows, error } = await supabase.rpc("discover_workout_feed");
  if (error) throw new Error(error.message);
  const feed = (rows ?? []) as unknown as FeedRow[];
  const ids = [
    ...new Set(
      feed.flatMap((r) => (Array.isArray(r.exercises) ? r.exercises : []).map((i) => i.exerciseId)),
    ),
  ];
  const facts = new Map<string, ExerciseFacts>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data: ex, error: exError } = await supabase
      .from("exercises")
      .select("id,name,primary_muscles,equipment,image_start,image_bg")
      .in("id", ids.slice(i, i + 300));
    if (exError) throw new Error(exError.message);
    for (const e of ex ?? [])
      facts.set(e.id, {
        name: e.name,
        primary: e.primary_muscles ?? [],
        equipment: e.equipment,
        imageStart: e.image_start,
        imageBg: e.image_bg,
      });
  }
  return feed.map((r) =>
    toCard({ ...r, exercises: Array.isArray(r.exercises) ? r.exercises : [] }, facts),
  );
}
