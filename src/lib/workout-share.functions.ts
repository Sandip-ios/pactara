import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LogType } from "@/lib/lift-rules";
import {
  chatSharePushText,
  crewsAlreadySent,
  firstNameOf,
  isShareCode,
  itemsFromLoggedWorkout,
  itemsFromSnapshot,
  shareUrl,
  type PublicSharedWorkout,
  type ShareCrew,
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
    const { ensureSnapshot } = await import("@/lib/shared-workouts.server");
    const { code, name } = await ensureSnapshot(supabase as SupabaseClient, userId, data.workoutId);
    return { code, url: shareUrl(code), name };
  });

export type { ShareCrew };

/**
 * The Share panel for one of your saved workouts: your crews (most recent
 * chat first) and the ones that already got this exact version from you.
 * Opening the panel never makes a link.
 */
export const getWorkoutSharePanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workoutId: string }) => ({ workoutId: String(input?.workoutId ?? "") }))
  .handler(async ({ context, data }): Promise<{ crews: ShareCrew[]; sentGroupIds: string[] }> => {
    const { supabase, userId } = context;
    const { currentSnapshot } = await import("@/lib/shared-workouts.server");
    const { loadShareCrews } = await import("@/lib/share-crews.server");
    const [snap, crews] = await Promise.all([
      currentSnapshot(supabase as SupabaseClient, userId, data.workoutId),
      loadShareCrews(supabase as SupabaseClient, userId),
    ]);
    if (!crews.length) return { crews: [], sentGroupIds: [] };
    const { data: sent } = snap.code
      ? await supabase.from("group_messages").select("group_id, shared_workout_code").eq("user_id", userId).eq("shared_workout_code", snap.code)
      : { data: [] as { group_id: string; shared_workout_code: string | null }[] };
    const sentGroupIds = crewsAlreadySent(
      (sent ?? []).map((m) => ({ groupId: m.group_id as string, code: (m.shared_workout_code as string | null) ?? null })),
      snap.code,
    );
    return { crews, sentGroupIds };
  });

/**
 * Posts the workout (as it's saved now) into a crew's chat as a workout card.
 * Same link as the share sheet; sending the same version twice does nothing.
 */
export const sendWorkoutToCrew = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workoutId: string; groupId: string }) => ({
    workoutId: String(input?.workoutId ?? ""),
    groupId: String(input?.groupId ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { ensureSnapshot } = await import("@/lib/shared-workouts.server");
    const { code, name } = await ensureSnapshot(supabase as SupabaseClient, userId, data.workoutId);
    const { data: already } = await supabase
      .from("group_messages")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("user_id", userId)
      .eq("shared_workout_code", code)
      .limit(1)
      .maybeSingle();
    if (already) return { code, groupId: data.groupId, already: true };
    // Membership and link ownership are checked by the message rules.
    const { error } = await supabase
      .from("group_messages")
      .insert({ group_id: data.groupId, user_id: userId, body: "", shared_workout_code: code });
    if (error) throw new Error(error.message);
    try {
      const { notifyGroupActivity, displayName } = await import("@/lib/notify.server");
      const full = await displayName(userId);
      await notifyGroupActivity(data.groupId, userId, {
        title: full,
        body: chatSharePushText(firstNameOf(full), name),
        url: `/chat/${data.groupId}`,
      });
    } catch (err) {
      console.warn("[share] chat push failed", err);
    }
    return { code, groupId: data.groupId, already: false };
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
