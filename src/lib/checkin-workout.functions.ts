import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { visibleCheckInWorkout } from "./checkin-workout.server";
import { itemsFromLoggedWorkout } from "./workout-share";

const input = z.object({ postId: z.string().uuid(), kind: z.enum(["workout", "meal"]).default("workout") });
export const getCheckInWorkout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => input.parse(data))
  .handler(async ({ context, data }) => {
    const { detail, sessionId, crewName } = await visibleCheckInWorkout(context.supabase as SupabaseClient, data.postId);
    const { data: saved, error } = await context.supabase.from("workouts").select("id")
      .eq("user_id", context.userId).eq("source_session_id", sessionId).limit(1).maybeSingle();
    if (error) throw new Error("Could not load saved workout");
    return { ...detail, crewName, savedWorkoutId: saved?.id ?? null };
  });

export const toggleCheckInWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => input.extend({ on: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    if (data.kind !== "workout") throw new Error("That workout isn't available");
    const { detail, sessionId, authorId } = await visibleCheckInWorkout(context.supabase as SupabaseClient, data.postId);
    if (authorId === context.userId) throw new Error("This is your own workout");
    if (!data.on) {
      const { error } = await context.supabase.from("workouts").delete()
        .eq("user_id", context.userId).eq("source_session_id", sessionId);
      if (error) throw new Error("Could not remove workout");
      return { added: false };
    }
    const { insertWorkoutCopy } = await import("./shared-workouts.server");
    await insertWorkoutCopy(context.supabase as SupabaseClient, context.userId, {
      name: detail.title,
      items: itemsFromLoggedWorkout(detail.exercises),
      source: { sessionId, userId: authorId },
    });
    return { added: true };
  });