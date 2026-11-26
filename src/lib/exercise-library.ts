import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLiftHistory, getMyWorkouts } from "@/lib/lifts.functions";
import type { Equipment, LogType } from "@/lib/lift-rules";

/** A RepDB library exercise, or one a member created (custom). */
export type LibraryExercise = {
  id: string;
  name: string;
  primary: string[];
  secondary: string[];
  equipment: Equipment;
  category: string;
  logType: LogType;
  imageStart: string | null;
  imagePeak: string | null;
  /** Background color behind the drawing. */
  imageBg: string | null;
  custom: boolean;
  /** RepDB difficulty (beginner / intermediate / advanced); null for your own exercises. */
  difficulty: string | null;
  /** RepDB family of versions of the same move, used to find an easier one. */
  variationGroup: string | null;
};

export async function fetchExerciseLibrary(): Promise<LibraryExercise[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, primary_muscles, secondary_muscles, equipment, category, log_type, image_start, image_peak, image_bg, owner_id, difficulty, variation_group")
    .order("name")
    .range(0, 2999);
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    primary: e.primary_muscles ?? [],
    secondary: e.secondary_muscles ?? [],
    equipment: e.equipment as Equipment,
    category: e.category,
    logType: e.log_type as LogType,
    imageStart: e.image_start,
    imagePeak: e.image_peak,
    imageBg: e.image_bg ?? null,
    custom: !!e.owner_id,
    difficulty: e.difficulty ?? null,
    variationGroup: e.variation_group ?? null,
  }));
}

export const EXERCISE_LIBRARY_KEY = ["exercise-library"] as const;

export function useExerciseLibrary() {
  return useQuery({ queryKey: EXERCISE_LIBRARY_KEY, queryFn: fetchExerciseLibrary, staleTime: 60 * 60_000 });
}

export function useExerciseMap() {
  const q = useExerciseLibrary();
  const map = new Map((q.data ?? []).map((e) => [e.id, e]));
  return { ...q, map };
}

export type ExerciseDetail = { instructions: string[]; tips: string[]; description: string | null };

export async function fetchExerciseDetail(id: string): Promise<ExerciseDetail> {
  const { data } = await supabase.from("exercises").select("instructions, tips, description").eq("id", id).maybeSingle();
  return { instructions: data?.instructions ?? [], tips: data?.tips ?? [], description: data?.description ?? null };
}

/** Steps, tips and the plain description for the How to page. */
export function useExerciseDetail(id: string | null) {
  return useQuery({
    queryKey: ["exercise-detail", id],
    queryFn: () => fetchExerciseDetail(id!),
    enabled: !!id,
    staleTime: 60 * 60_000,
  });
}

export const LIFT_HISTORY_KEY = ["lift-history"] as const;
export function useLiftHistory() {
  return useQuery({ queryKey: LIFT_HISTORY_KEY, queryFn: () => getLiftHistory(), staleTime: 30_000 });
}

export const MY_WORKOUTS_KEY = ["my-workouts"] as const;
export function useMyWorkouts() {
  return useQuery({ queryKey: MY_WORKOUTS_KEY, queryFn: () => getMyWorkouts(), staleTime: 30_000 });
}
