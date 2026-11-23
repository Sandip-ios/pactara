import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LogType } from "@/lib/lift-rules";
import {
  isShareCode,
  itemsFromLoggedWorkout,
  itemsFromSnapshot,
  makeShareCode,
  snapshotKey,
  snapshotOf,
  shareUrl,
  type PublicSharedWorkout,
  type SnapshotItem,
  type TemplateItem,
} from "@/lib/workout-share";

export type { PublicSharedWorkout };

const codeInput = (input: { code: string }) => {
  const code = String(input?.code ?? "");
  if (!isShareCode(code)) throw new Error("Unknown link");
  return { code };
};

/**
 * Save a crewmate's logged workout (from the feed) to My workouts. Only
 * someone in the crew that can see the check-in can save it; never your own.
 */
export const saveCrewWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { checkInId: string }) => ({ checkInId: String(input?.checkInId ?? "") }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // The detail function only answers for members of the post's crew.
    const { data: res, error } = await supabase.rpc("workout_detail_for_check_in", { _check_in_id: data.checkInId });
    if (error || !res) throw new Error("That workout isn't available");
    const raw = res as {
      title: string | null;
      sessionId: string;
      userId: string;
      sets: { exerciseId: string; logType: LogType; seconds: number | null }[];
    };
    if (raw.userId === userId) throw new Error("This is your own workout");
    // Consecutive sets of one exercise are one exercise, in the order logged.
    const grouped: { exerciseId: string; logType: LogType; sets: { seconds: number | null }[] }[] = [];
    for (const s of raw.sets ?? []) {
      const last = grouped[grouped.length - 1];
      if (last && last.exerciseId === s.exerciseId) last.sets.push({ seconds: s.seconds });
      else grouped.push({ exerciseId: s.exerciseId, logType: s.logType, sets: [{ seconds: s.seconds }] });
    }
    const { insertWorkoutCopy } = await import("@/lib/shared-workouts.server");
    return insertWorkoutCopy(supabase as SupabaseClient, userId, {
      name: raw.title,
      items: itemsFromLoggedWorkout(grouped),
      source: { sessionId: raw.sessionId, userId: raw.userId },
    });
  });

/**
 * A link to one of your saved workouts, as it's saved right now. Sharing
 * the same content again reuses the last link.
 */
export const shareSavedWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workoutId: string }) => ({ workoutId: String(input?.workoutId ?? "") }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: wk } = await supabase
      .from("workouts")
      .select("id, name, exercises")
      .eq("id", data.workoutId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!wk) throw new Error("That workout is gone");
    const items = (Array.isArray(wk.exercises) ? wk.exercises : []) as TemplateItem[];
    const ids = [...new Set(items.map((i) => i.exerciseId))];
    const { data: exRows } = ids.length
      ? await supabase.from("exercises").select("id, log_type").in("id", ids)
      : { data: [] as { id: string; log_type: string }[] };
    const logTypes = new Map((exRows ?? []).map((e) => [e.id as string, e.log_type as string]));
    const snapshot = snapshotOf(
      items.filter((i) => logTypes.has(i.exerciseId)),
      (id) => (logTypes.get(id) === "timed" ? "timed" : "reps"),
    );
    if (!snapshot.length) throw new Error("Nothing to share");
    const name = (wk.name as string).trim();

    const { data: last } = await supabase
      .from("shared_workouts")
      .select("code, name, exercises")
      .eq("owner_id", userId)
      .eq("workout_id", wk.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && snapshotKey(last.name as string, (last.exercises ?? []) as SnapshotItem[]) === snapshotKey(name, snapshot)) {
      return { code: last.code as string, url: shareUrl(last.code as string), name };
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeShareCode();
      const { error } = await supabase
        .from("shared_workouts")
        .insert({ code, owner_id: userId, workout_id: wk.id, name, exercises: snapshot as never });
      if (!error) return { code, url: shareUrl(code), name };
      if (error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("Couldn't make a link");
  });

/** Public: what a share link shows (works signed out; used for link previews too). */
export const getSharedWorkout = createServerFn({ method: "GET" })
  .inputValidator((input: { code: string }) => ({ code: String(input?.code ?? "") }))
  .handler(async ({ data }): Promise<PublicSharedWorkout | null> => {
    if (!isShareCode(data.code)) return null;
    const { loadSharedWorkout } = await import("@/lib/shared-workouts.server");
    const found = await loadSharedWorkout(data.code);
    return found?.workout ?? null;
  });

/** Signed in: is this link yours, and have you saved it already? */
export const getSharedWorkoutStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const [{ data: own }, { data: saved }] = await Promise.all([
      // Owners can read their own links; anyone else gets nothing back.
      supabase.from("shared_workouts").select("workout_id").eq("code", data.code).eq("owner_id", userId).maybeSingle(),
      supabase.from("workouts").select("id").eq("user_id", userId).eq("source_share_code", data.code).limit(1).maybeSingle(),
    ]);
    let ownWorkoutId: string | null = null;
    if (own?.workout_id) {
      const { data: still } = await supabase.from("workouts").select("id").eq("id", own.workout_id).eq("user_id", userId).maybeSingle();
      ownWorkoutId = (still?.id as string | undefined) ?? null;
    }
    return { isOwner: !!own, ownWorkoutId, savedWorkoutId: (saved?.id as string | undefined) ?? null };
  });

/** Save a share link to My workouts (your own link opens your workout instead). */
export const saveSharedWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { loadSharedWorkout, insertWorkoutCopy } = await import("@/lib/shared-workouts.server");
    const found = await loadSharedWorkout(data.code);
    if (!found) return { status: "missing" as const };
    if (found.ownerId === userId) {
      let ownWorkoutId: string | null = null;
      if (found.workoutId) {
        const { data: still } = await supabase.from("workouts").select("id").eq("id", found.workoutId).eq("user_id", userId).maybeSingle();
        ownWorkoutId = (still?.id as string | undefined) ?? null;
      }
      return { status: "own" as const, workoutId: ownWorkoutId, name: found.workout.name };
    }
    const copy = await insertWorkoutCopy(supabase as SupabaseClient, userId, {
      name: found.workout.name,
      items: itemsFromSnapshot(found.workout.exercises),
      source: { shareCode: data.code, userId: found.ownerId },
    });
    return { status: "saved" as const, ...copy };
  });
