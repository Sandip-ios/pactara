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

/**
 * The share-link snapshot of one of your saved workouts as it's saved now,
 * and the code of the last link made for it when that link still matches.
 */
export async function currentSnapshot(
  supabase: SupabaseClient,
  userId: string,
  workoutId: string,
): Promise<{ workoutId: string; name: string; snapshot: SnapshotItem[]; code: string | null }> {
  const { snapshotKey, snapshotOf } = await import("@/lib/workout-share");
  const { data: wk } = await supabase
    .from("workouts")
    .select("id, name, exercises")
    .eq("id", workoutId)
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
  const name = (wk.name as string).trim();
  const { data: last } = await supabase
    .from("shared_workouts")
    .select("code, name, exercises")
    .eq("owner_id", userId)
    .eq("workout_id", wk.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const same = !!last && snapshotKey(last.name as string, (last.exercises ?? []) as SnapshotItem[]) === snapshotKey(name, snapshot);
  return { workoutId: wk.id as string, name, snapshot, code: same ? (last!.code as string) : null };
}

/** Reuses the last link when the workout hasn't changed, otherwise makes a new one. */
export async function ensureSnapshot(supabase: SupabaseClient, userId: string, workoutId: string): Promise<{ code: string; name: string }> {
  const { makeShareCode } = await import("@/lib/workout-share");
  const cur = await currentSnapshot(supabase, userId, workoutId);
  if (!cur.snapshot.length) throw new Error("Nothing to share");
  if (cur.code) return { code: cur.code, name: cur.name };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeShareCode();
    const { error } = await supabase
      .from("shared_workouts")
      .insert({ code, owner_id: userId, workout_id: cur.workoutId, name: cur.name, exercises: cur.snapshot as never });
    if (!error) return { code, name: cur.name };
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Couldn't make a link");
}

/** What a chat card shows for a shared workout: name, set counts, exercise pictures. No weights. */
export type ChatWorkoutCard = {
  code: string;
  name: string;
  exercises: { sets: number; name: string; imageStart: string | null; primary: string[] }[];
};

/** Chat cards for many share codes at once (public fields only, same as the /w/ page). */
export async function loadChatWorkoutCards(codes: readonly string[]): Promise<Map<string, ChatWorkoutCard>> {
  const out = new Map<string, ChatWorkoutCard>();
  const valid = [...new Set(codes.filter(isShareCode))];
  if (!valid.length) return out;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin.from("shared_workouts").select("code, name, exercises").in("code", valid);
  const all = (rows ?? []).map((r) => ({ code: r.code as string, name: r.name as string, items: (Array.isArray(r.exercises) ? r.exercises : []) as SnapshotItem[] }));
  const ids = [...new Set(all.flatMap((r) => r.items.map((i) => i.exerciseId)))];
  const { data: exRows } = ids.length
    ? await supabaseAdmin.from("exercises").select("id, name, image_start, primary_muscles").in("id", ids)
    : { data: [] as never[] };
  const byId = new Map((exRows ?? []).map((e) => [e.id as string, e]));
  for (const r of all) {
    out.set(r.code, {
      code: r.code,
      name: r.name,
      exercises: r.items
        .filter((i) => byId.has(i.exerciseId))
        .map((i) => {
          const e = byId.get(i.exerciseId)!;
          return {
            sets: i.sets,
            name: e.name as string,
            imageStart: (e.image_start as string | null) ?? null,
            primary: (e.primary_muscles as string[] | null) ?? [],
          };
        }),
    });
  }
  return out;
}
