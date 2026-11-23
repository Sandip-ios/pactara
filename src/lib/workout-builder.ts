/**
 * Build / edit a saved workout before starting it (pure rules, no React).
 * A saved workout is an ordered list of exercises with a set count each.
 */
import { plural } from "@/lib/lift-rules";

export const MIN_SETS = 1;
export const MAX_SETS = 10;
/** Rough time per working set, rest included. */
export const MINUTES_PER_SET = 2.6;

export type DraftItem = { key: string; exerciseId: string; sets: number; restSeconds?: number };

/** New exercises start at 3 sets; bodyweight moves at 2. */
export function defaultSets(equipment: string): number {
  return equipment === "bodyweight" ? 2 : 3;
}

export function clampSets(n: number): number {
  return Math.max(MIN_SETS, Math.min(MAX_SETS, Math.round(n)));
}

/** About 2.6 min a set, rounded to the nearest 5 (never under 5). */
export function estimateMinutes(totalSets: number): number {
  if (totalSets <= 0) return 0;
  return Math.max(5, Math.round((totalSets * MINUTES_PER_SET) / 5) * 5);
}

/** "4 exercises · 11 sets · about 30 min" */
export function draftMeta(items: Pick<DraftItem, "sets">[]): string {
  if (!items.length) return "0 exercises";
  const sets = items.reduce((a, i) => a + i.sets, 0);
  return `${plural(items.length, "exercise")} · ${plural(sets, "set")} · about ${estimateMinutes(sets)} min`;
}

/** Moves one item to a new index. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items;
  const out = [...items];
  const [it] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, it!);
  return out;
}

/**
 * Back in the picker, the member's picks come back as an ordered id list.
 * Keep what was set up for exercises still picked (sets, rest, duplicates),
 * in the new order, and add fresh items for new picks.
 */
export function syncPicks(draft: DraftItem[], pickedIds: string[], fresh: (exerciseId: string) => DraftItem): DraftItem[] {
  const out: DraftItem[] = [];
  for (const id of pickedIds) {
    const kept = draft.filter((d) => d.exerciseId === id);
    if (kept.length) out.push(...kept);
    else out.push(fresh(id));
  }
  return out;
}

/** Unique exercise ids in draft order (what the picker shows as picked). */
export function pickedIdsOf(draft: DraftItem[]): string[] {
  return [...new Set(draft.map((d) => d.exerciseId))];
}

/** Save is possible with a name and at least one exercise. */
export function canSave(name: string, items: DraftItem[]): boolean {
  return name.trim().length > 0 && items.length > 0;
}

/**
 * My workouts order: most recent of "last done" and "saved", newest first,
 * so a workout you just built shows at the top.
 */
export function sortMyWorkouts<T extends { lastDoneAt: string | null; createdAt: string }>(list: T[]): T[] {
  const at = (w: T) => (w.lastDoneAt && w.lastDoneAt > w.createdAt ? w.lastDoneAt : w.createdAt);
  return [...list].sort((a, b) => at(b).localeCompare(at(a)));
}
