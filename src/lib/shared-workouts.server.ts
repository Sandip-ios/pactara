import type { SupabaseClient } from "@supabase/supabase-js";
import type { LogType } from "@/lib/lift-rules";
import { firstNameOf, isShareCode, uniqueWorkoutName, type PublicSharedWorkout, type SnapshotItem, type TemplateItem } from "@/lib/workout-share";

/**
 * Reads a share link by its code. Links are only readable through the
 * server (no public table access), so this uses the service client and
 * returns only the public fields plus the owner/source ids for server use.
 */
export async function loadSharedWorkout(
  code: string,
): Promise<{ ownerId: string; workoutId: string | null; workout: PublicSharedWorkout } | null> {
  if (!isShareCode(code)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("shared_workouts")
    .select("code, owner_id, workout_id, name, exercises")
    .eq("code", code)
    .maybeSingle();
  if (!row) return null;
  const items = (Array.isArray(row.exercises) ? row.exercises : []) as SnapshotItem[];
  const ids = [...new Set(items.map((i) => i.exerciseId))];
  const [{ data: exRows }, { data: owner }] = await Promise.all([
    ids.length
      ? supabaseAdmin.from("exercises").select("id, name, image_start, primary_muscles, equipment, log_type").in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
    supabaseAdmin.from("profiles").select("name, avatar_url, avatar_color").eq("id", row.owner_id).maybeSingle(),
  ]);
  const byId = new Map((exRows ?? []).map((e) => [e.id as string, e]));
  let avatarUrl: string | null = null;
  const path = (owner?.avatar_url as string | null | undefined) ?? null;
  if (path) {
    if (path.startsWith("http")) avatarUrl = path;
    else {
      const { signAvatarThumbs } = await import("@/lib/media-urls");
      avatarUrl = (await signAvatarThumbs(supabaseAdmin as unknown as SupabaseClient, [path], 144)).get(path) ?? null;
    }
  }
  return {
    ownerId: row.owner_id as string,
    workoutId: (row.workout_id as string | null) ?? null,
    workout: {
      code: row.code as string,
      name: row.name as string,
      ownerFirstName: firstNameOf(owner?.name as string | undefined),
      ownerAvatarUrl: avatarUrl,
      ownerAvatarColor: (owner?.avatar_color as string | undefined) ?? "#7C3AED",
      exercises: items
        .filter((i) => byId.has(i.exerciseId))
        .map((i) => {
          const e = byId.get(i.exerciseId)!;
          return {
            exerciseId: i.exerciseId,
            sets: i.sets,
            repsTarget: i.repsTarget ?? null,
            secondsTarget: i.secondsTarget ?? null,
            name: e.name as string,
            imageStart: (e.image_start as string | null) ?? null,
            primary: (e.primary_muscles as string[] | null) ?? [],
            equipment: e.equipment as string,
            logType: (e.log_type === "timed" ? "timed" : "reps") as LogType,
          };
        }),
    },
  };
}

export type CopyResult = { workoutId: string; name: string; already: boolean };

/**
 * Adds a copy to the member's My workouts (as the member, so RLS applies).
 * Exercises they can't see (someone else's custom moves) are left out.
 * One copy per source: a second save returns the first copy.
 */
export async function insertWorkoutCopy(
  supabase: SupabaseClient,
  userId: string,
  input: {
    name: string | null;
    items: TemplateItem[];
    source: { sessionId?: string; shareCode?: string; userId: string };
  },
): Promise<CopyResult> {
  const existingCopy = async () => {
    let q = supabase.from("workouts").select("id, name").eq("user_id", userId);
    q = input.source.sessionId ? q.eq("source_session_id", input.source.sessionId) : q.eq("source_share_code", input.source.shareCode ?? "");
    const { data } = await q.limit(1).maybeSingle();
    return data ? { workoutId: data.id as string, name: data.name as string, already: true } : null;
  };
  const found = await existingCopy();
  if (found) return found;

  const ids = [...new Set(input.items.map((i) => i.exerciseId))];
  const [{ data: visible }, { data: mine }] = await Promise.all([
    supabase.from("exercises").select("id").in("id", ids),
    supabase.from("workouts").select("name").eq("user_id", userId),
  ]);
  const ok = new Set((visible ?? []).map((e) => e.id as string));
  const items = input.items.filter((i) => ok.has(i.exerciseId)).slice(0, 40);
  if (!items.length) throw new Error("Nothing to save");
  const name = uniqueWorkoutName(input.name, (mine ?? []).map((w) => w.name as string));
  const { data, error } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      name,
      exercises: items as never,
      source_user_id: input.source.userId,
      source_session_id: input.source.sessionId ?? null,
      source_share_code: input.source.shareCode ?? null,
    })
    .select("id, name")
    .single();
  if (error) {
    // Saved from another tap or device a moment ago.
    if (error.code === "23505") {
      const raced = await existingCopy();
      if (raced) return raced;
    }
    throw new Error(error.message);
  }
  return { workoutId: data.id as string, name: data.name as string, already: false };
}
