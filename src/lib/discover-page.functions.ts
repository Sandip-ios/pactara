import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { didYouMean, searchMatches, type SearchPerson } from "./discover-page";
import { goalLabel, type PlanGoal } from "./workout-plans";
import { filterCards } from "./discover-workouts";
import { signAvatarThumbs } from "./media-urls";
export const getDiscoverPlanStarts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("discover_plan_starts");
    if (error) throw new Error(error.message);
    return (data ?? {}) as Record<string, number>;
  });
export const searchDiscover = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q: string }) => ({
    q: String(input.q ?? "")
      .trim()
      .slice(0, 80),
  }))
  .handler(async ({ context, data }) => {
    const { loadDiscoverCards } = await import("./discover-cards.server");
    const [peopleRes, plansRes, cards] = await Promise.all([
      context.supabase.rpc("search_discover_people", { query_text: data.q }),
      context.supabase
        .from("plans")
        .select("id,name,goal")
        .eq("is_published", true)
        .order("sort_order"),
      loadDiscoverCards(context.supabase),
    ]);
    if (peopleRes.error || plansRes.error) throw new Error("Could not load results");
    const people = (peopleRes.data ?? []) as unknown as SearchPerson[];
    const avatars = await signAvatarThumbs(
      context.supabase,
      people.map((p) => p.avatar),
    );
    const plans = plansRes.data ?? [];
    return {
      people: people.map((p) => ({
        ...p,
        avatar: p.avatar?.startsWith("https://") ? p.avatar : (avatars.get(p.avatar ?? "") ?? null),
      })),
      workouts: filterCards(cards, {
        q: data.q,
        muscle: "all",
        equipment: null,
        time: null,
        sort: "saved",
      }),
      planIds: plans
        .filter((p) =>
          searchMatches(data.q, [
            p.name,
            goalLabel(p.goal as PlanGoal),
            p.goal.replaceAll("_", " "),
          ]),
        )
        .map((p) => p.id),
      suggestion: didYouMean(data.q, [
        "back",
        "core",
        "chest",
        "glutes",
        "legs",
        "arms",
        ...plans.flatMap((p) => [p.name, goalLabel(p.goal as PlanGoal)]),
        ...cards.map((c) => c.name),
      ]),
    };
  });

/** Recheck Discover visibility at the moment a listed workout is opened or saved. */
export const getDiscoverWorkout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code) }))
  .handler(async ({ context, data }) => {
    const { data: feed, error } = await context.supabase.rpc("discover_workout_feed");
    if (error) throw new Error("Could not load workout");
    if (!(feed ?? []).some((row) => row.code === data.code)) return null;
    const { loadSharedWorkout } = await import("./shared-workouts.server");
    return (await loadSharedWorkout(data.code, context.userId))?.workout ?? null;
  });
export const saveDiscoverWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code) }))
  .handler(async ({ context, data }) => {
    const { data: feed, error } = await context.supabase.rpc("discover_workout_feed");
    if (error || !(feed ?? []).some((row) => row.code === data.code))
      return { status: "missing" as const };
    const { loadSharedWorkout, insertWorkoutCopy } = await import("./shared-workouts.server");
    const found = await loadSharedWorkout(data.code, context.userId);
    if (!found || found.ownerId === context.userId) return { status: "missing" as const };
    const { itemsFromSnapshot } = await import("./workout-share");
    const { data: source, error: sourceError } =
      await context.supabase.rpc("discover_workout_feed");
    if (sourceError) return { status: "missing" as const };
    const row = (source ?? []).find((r) => r.code === data.code);
    if (!row) return { status: "missing" as const };
    const copy = await insertWorkoutCopy(context.supabase, context.userId, {
      name: found.workout.name,
      items: itemsFromSnapshot(
        row.exercises as unknown as import("./workout-share").SnapshotItem[],
      ),
      source: { shareCode: data.code, userId: found.ownerId },
    });
    return { status: "saved" as const, ...copy };
  });

