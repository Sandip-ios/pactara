import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isShareCode } from "@/lib/workout-share";
import { authorDisplayName } from "@/lib/new-workout-view";

export type WorkoutPageExercise = {
  exerciseId: string;
  sets: number;
  reps: string | null;
  seconds: number | null;
  tip: string | null;
  restSeconds: number | null;
  /** Fallbacks for exercises missing from the viewer's library (someone's custom move). */
  name: string | null;
  imageStart: string | null;
  primary: string[];
  detail: string[];
};

export type WorkoutPage = {
  /** Own workout id, or the share code for someone else's. */
  key: string;
  workoutId: string | null;
  shareCode: string | null;
  name: string;
  isMine: boolean;
  author: { kind: "you" | "member" | "pactara"; name: string; avatarUrl: string | null; avatarColor: string };
  /** Someone else's: the copy already in my workouts. */
  savedWorkoutId: string | null;
  /** Own workouts: gym / dumbbells / home, when set. */
  equipment: "gym" | "dumbbells" | "home" | null;
  exercises: WorkoutPageExercise[];
};

type RawItem = { exerciseId: string; sets: number; reps?: string; tip?: string; seconds?: number; restSeconds?: number };

/**
 * The new-version workout page. A uuid opens one of my saved workouts (RLS:
 * owner only); a share code opens someone else's through the public share
 * snapshot (exercises and sets only, never weights or history).
 */
export const getWorkoutPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ context, data }): Promise<WorkoutPage | null> => {
    const { supabase, userId } = context;
    if (isShareCode(data.id)) {
      const { loadSharedWorkout } = await import("@/lib/shared-workouts.server");
      const found = await loadSharedWorkout(data.id, userId);
      if (!found) return null;
      const isMine = found.ownerId === userId;
      if (isMine && found.workoutId) {
        const { data: still } = await supabase.from("workouts").select("id").eq("id", found.workoutId).eq("user_id", userId).maybeSingle();
        if (still?.id) return ownPage(supabase as SupabaseClient, userId, still.id as string);
      }
      const { data: saved } = await supabase.from("workouts").select("id").eq("user_id", userId).eq("source_share_code", data.id).limit(1).maybeSingle();
      const w = found.workout;
      return {
        key: data.id,
        workoutId: null,
        shareCode: data.id,
        name: w.name,
        isMine,
        author: { kind: isMine ? "you" : "member", name: isMine ? "you" : found.owner ? authorDisplayName(found.owner) : w.ownerFirstName, avatarUrl: w.ownerAvatarUrl, avatarColor: w.ownerAvatarColor },
        savedWorkoutId: (saved?.id as string | undefined) ?? null,
        equipment: null,
        exercises: w.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          sets: e.sets,
          reps: e.reps ?? null,
          seconds: e.secondsTarget ?? null,
          tip: e.tip ?? null,
          restSeconds: null,
          name: e.name,
          imageStart: e.imageStart,
          primary: e.primary,
          detail: e.detail ?? [],
        })),
      };
    }
    if (!/^[0-9a-f-]{36}$/i.test(data.id)) return null;
    return ownPage(supabase as SupabaseClient, userId, data.id);
  });

async function ownPage(supabase: SupabaseClient, userId: string, id: string): Promise<WorkoutPage | null> {
  const [{ data: wk }, { data: me }] = await Promise.all([
    supabase.from("workouts").select("id, name, exercises, equipment").eq("id", id).eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("avatar_url, avatar_color").eq("id", userId).maybeSingle(),
  ]);
  if (!wk) return null;
  let avatarUrl: string | null = null;
  const path = (me?.avatar_url as string | null | undefined) ?? null;
  if (path) {
    if (path.startsWith("http")) avatarUrl = path;
    else {
      const { signAvatarThumbs } = await import("@/lib/media-urls");
      avatarUrl = (await signAvatarThumbs(supabase, [path], 96)).get(path) ?? null;
    }
  }
  const items = (Array.isArray(wk.exercises) ? wk.exercises : []) as RawItem[];
  return {
    key: wk.id as string,
    workoutId: wk.id as string,
    shareCode: null,
    name: wk.name as string,
    isMine: true,
    author: { kind: "you", name: "you", avatarUrl, avatarColor: (me?.avatar_color as string | undefined) ?? "#7C3AED" },
    savedWorkoutId: null,
    equipment: wk.equipment === "gym" || wk.equipment === "dumbbells" || wk.equipment === "home" ? wk.equipment : null,
    exercises: items.map((i) => ({
      exerciseId: i.exerciseId,
      sets: i.sets,
      reps: typeof i.reps === "string" ? i.reps : null,
      seconds: typeof i.seconds === "number" ? i.seconds : null,
      tip: typeof i.tip === "string" ? i.tip : null,
      restSeconds: typeof i.restSeconds === "number" ? i.restSeconds : null,
      name: null,
      imageStart: null,
      primary: [],
      detail: [],
    })),
  };
}
