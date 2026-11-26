/**
 * Workout page (new version): pure rules for the stat tiles, muscle chips,
 * dose wording and which buttons show. No React, no data access.
 */
import { estimateMinutes } from "@/lib/workout-builder";

export const TIP_MAX = 120;

export type WorkoutPageItem = { exerciseId: string; sets: number; reps?: string | null; seconds?: number | null; primary: string[] };

/** "45 min / time", "6 / exercises", "20 / sets": time from the builder's estimate. */
export function workoutStats(items: readonly Pick<WorkoutPageItem, "sets">[]): { minutes: number; exercises: number; sets: number } {
  const sets = items.reduce((a, i) => a + Math.max(0, i.sets), 0);
  return { minutes: estimateMinutes(sets), exercises: items.length, sets };
}

const MUSCLE_WORDS: Record<string, string> = { traps: "Upper back", abs: "Core", lats: "Lats", lower_back: "Lower back" };

export function muscleWord(key: string): string {
  const k = key.trim().toLowerCase();
  if (MUSCLE_WORDS[k]) return MUSCLE_WORDS[k];
  const w = k.replace(/[_-]+/g, " ");
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * Top 3 primary muscles across the exercises, by how many exercises list
 * them (ties: first seen). Each exercise counts a muscle once.
 */
export function topMuscleChips(items: readonly Pick<WorkoutPageItem, "primary">[], limit = 3): string[] {
  const count = new Map<string, { n: number; first: number }>();
  let order = 0;
  for (const it of items) {
    for (const m of new Set(it.primary.map((p) => p.trim().toLowerCase()).filter(Boolean))) {
      const c = count.get(m);
      if (c) c.n += 1;
      else count.set(m, { n: 1, first: order++ });
    }
  }
  const labels: string[] = [];
  for (const [m] of [...count.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)) {
    const label = muscleWord(m);
    if (!labels.includes(label)) labels.push(label);
    if (labels.length === limit) break;
  }
  return labels;
}

/** "4 × 8", "3 × 10 each", "3 × 30 sec", or just "3 sets" without reps. */
export function doseText(item: Pick<WorkoutPageItem, "sets" | "reps" | "seconds">): string {
  const reps = (item.reps ?? "").trim();
  if (reps) return `${item.sets} × ${reps}`;
  if (item.seconds && item.seconds > 0) return `${item.sets} × ${item.seconds} sec`;
  return item.sets === 1 ? "1 set" : `${item.sets} sets`;
}

/** The author's tip as shown: trimmed, at most 120 characters, null when empty. */
export function tipText(tip: string | null | undefined): string | null {
  const t = (tip ?? "").trim();
  return t ? t.slice(0, TIP_MAX) : null;
}

export type WorkoutButtons = {
  /** The lavender button next to Start now. */
  secondary: "edit" | "save" | "saved";
  menu: ("edit" | "share" | "delete")[];
  /** "Saved by … · … did it" only for others' workouts with counts above 0. */
  showSocial: boolean;
};

export function workoutButtons(v: { isMine: boolean; saved: boolean; saves?: number | null; did?: number | null }): WorkoutButtons {
  if (v.isMine) return { secondary: "edit", menu: ["edit", "share", "delete"], showSocial: false };
  const showSocial = (v.saves ?? 0) > 0 || (v.did ?? 0) > 0;
  return { secondary: v.saved ? "saved" : "save", menu: ["share"], showSocial };
}

/** "Saved by 1,204 · 318 did it" (parts with 0 left out). */
export function socialLine(saves: number | null | undefined, did: number | null | undefined): string | null {
  const parts: string[] = [];
  if ((saves ?? 0) > 0) parts.push(`Saved by ${saves!.toLocaleString("en-US")}`);
  if ((did ?? 0) > 0) parts.push(`${did!.toLocaleString("en-US")} did it`);
  return parts.length ? parts.join(" · ") : null;
}
