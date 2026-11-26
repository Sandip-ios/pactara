import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  filterCards,
  mostSavedThisWeek,
  pageOf,
  parseEquipment,
  parseMuscle,
  parseSort,
  parseTime,
  toCard,
  type DiscoverCard,
  type ExerciseFacts,
  type FeedRow,
} from "@/lib/discover-workouts";

type Input = { muscle?: string; equipment?: string; time?: string; sort?: string; q?: string; offset?: number; withTop?: boolean };

export type DiscoverWorkoutsPage = { top: DiscoverCard[]; items: DiscoverCard[]; total: number; nextOffset: number | null };

/**
 * Discover › Workouts and the Workouts list page. Visibility (Pactara, or a
 * new-version, public, 18+ author with no block either way) is decided by the
 * discover_workout_feed RPC, which returns snapshot fields and counts only.
 */
export const getDiscoverWorkouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Input) => ({
    muscle: parseMuscle(i?.muscle),
    equipment: parseEquipment(i?.equipment),
    time: parseTime(i?.time),
    sort: parseSort(i?.sort),
    q: String(i?.q ?? "").slice(0, 80),
    offset: Math.max(0, Math.floor(Number(i?.offset) || 0)),
    withTop: !!i?.withTop,
  }))
  .handler(async ({ context, data }): Promise<DiscoverWorkoutsPage> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("discover_workout_feed" as never);
    if (error) throw new Error(error.message);
    const feed = (rows ?? []) as unknown as FeedRow[];
    const ids = [...new Set(feed.flatMap((r) => (Array.isArray(r.exercises) ? r.exercises : []).map((i) => i.exerciseId)))];
    const facts = new Map<string, ExerciseFacts>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data: ex } = await supabase.from("exercises").select("id, name, primary_muscles, equipment, image_start, image_bg").in("id", ids.slice(i, i + 300));
      for (const e of ex ?? []) {
        facts.set(e.id as string, {
          name: e.name as string,
          primary: (e.primary_muscles as string[] | null) ?? [],
          equipment: e.equipment as string,
          imageStart: (e.image_start as string | null) ?? null,
          imageBg: (e.image_bg as string | null) ?? null,
        });
      }
    }
    const cards = feed.map((r) => toCard({ ...r, exercises: Array.isArray(r.exercises) ? r.exercises : [] }, facts));
    const list = filterCards(cards, data);
    const { items, nextOffset } = pageOf(list, data.offset);
    return { top: data.withTop ? mostSavedThisWeek(cards) : [], items, total: list.length, nextOffset };
  });
