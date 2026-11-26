import { MUSCLE_REGIONS, muscleChips, type MuscleMap } from "@/lib/workout-plans";

/** "BUILD MUSCLE · TODAY" only when this is your active plan's next day; otherwise just the plan name. */
export function newPlanDayLabel(planName: string, isMyNextDay: boolean): string {
  return `${planName}${isMyNextDay ? " · Today" : ""}`.toUpperCase();
}

const sentence = (labels: string[]) =>
  labels.map((l, i) => (i === 0 ? l.charAt(0).toUpperCase() + l.slice(1).toLowerCase() : l.toLowerCase())).join(", ");

/** Legend rows: main muscles (2) in purple, also worked (1) in amber; the amber row is null when there are none. */
export function muscleLegend(map: MuscleMap): { primary: string | null; secondary: string | null } {
  const chips = muscleChips(map);
  const pick = (lv: 1 | 2) => chips.filter((c) => c.level === lv).map((c) => c.label);
  const p = pick(2);
  const s = pick(1);
  return { primary: p.length ? sentence(p) : null, secondary: s.length ? sentence(s) : null };
}

/** "3x8-12 · rest 90 sec" → "3 × 8-12"; "2x8 each leg" → "2 × 8 each leg"; other doses stay as written. */
export function shortDose(dose: string): string {
  const raw = dose.split("·")[0]!.trim();
  const m = raw.replace(/×/g, "x").match(/^(\d+)\s*x\s*(.+)$/i);
  // Timed doses read "3 × 30s" like the rest of the new version.
  return m ? `${m[1]} × ${m[2]!.trim().replace(/^(\d+)\s*(?:sec|secs|seconds|s)\b\.?/i, "$1s")}` : raw;
}

/** "5 exercises · 35 min · same weights, one more rep where you can" */
export function newPlanDayMeta(count: number, minutes: string, weekNote: string | null | undefined): string {
  const parts = [`${count} ${count === 1 ? "exercise" : "exercises"}`, `${minutes} min`];
  const note = weekNote?.trim().replace(/\.$/, "");
  if (note) parts.push(note.charAt(0).toLowerCase() + note.slice(1));
  return parts.join(" · ");
}

export { MUSCLE_REGIONS };
