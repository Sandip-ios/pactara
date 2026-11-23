/**
 * Plan day page: pure display rules (blocks, dose wording, chips).
 * Doses come from the plan's day data (already lightened for a lighter week).
 */
import type { PlanMove } from "@/lib/workout-plans";

export type PlanDayBlockKind = "warmup" | "workout" | "cooldown";
export type PlanDayBlock = { kind: PlanDayBlockKind; label: string; meta: string; moves: PlanMove[] };

const WARM = /warm[\s-]?up/i;
const COOL = /cool[\s-]?down/i;

/** Rest the set logger uses: 90 sec between rep sets, 60 sec between timed sets. */
export function restSecondsForDose(dose: string): number | null {
  const d = dose.replace(/×/g, "x").toLowerCase().trim();
  const m = d.match(/^(\d+)\s*x\s*\d+(?:\s*-\s*\d+)?\s*(sec|min)?/);
  if (m) return m[2] ? 60 : 90;
  if (/^\d+\s*sets?\b/.test(d)) return 90;
  return null;
}

/**
 * "3x8-12" → "3 sets × 8-12 reps · rest 90 sec"; "2x8 each leg" → "2 sets × 8 reps each leg · rest 90 sec";
 * "3x30 sec" → "3 sets × 30 sec · rest 60 sec". Anything else ("5 min", "8 rounds: …") stays as written.
 */
export function formatPlanDose(dose: string): string {
  const raw = dose.trim();
  const rest = restSecondsForDose(raw);
  const restText = rest ? ` · rest ${rest} sec` : "";
  const m = raw.replace(/×/g, "x").match(/^(\d+)\s*x\s*(.+)$/i);
  if (m) {
    const sets = Number(m[1]);
    const body = m[2]!.trim();
    const setsText = `${sets} ${sets === 1 ? "set" : "sets"}`;
    const amount = body.match(/^(\d+(?:\s*-\s*\d+)?)\s*(.*)$/);
    if (amount) {
      const tail = amount[2]!.trim();
      const timed = /^(sec|min)\b/i.test(tail);
      const needsReps = !timed && (tail === "" || /^each\b/i.test(tail));
      const what = needsReps ? `${amount[1]} reps${tail ? ` ${tail}` : ""}` : `${amount[1]} ${tail}`.trim();
      return `${setsText} × ${what}${restText}`;
    }
    return `${setsText} × ${body}${restText}`;
  }
  return `${raw}${restText}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "40" − 10 → "30"; "25–35" − 5 → "20–30". Never below 5. */
export function minusMinutes(minutes: string, less: number): string {
  return minutes.replace(/\d+/g, (n) => String(Math.max(5, Number(n) - less)));
}

/** WARM-UP / WORKOUT / COOL-DOWN; a block with no moves is left out. */
export function planDayBlocks(moves: PlanMove[], totalMinutes: string): PlanDayBlock[] {
  const warm = moves.filter((m) => WARM.test(m.name));
  const cool = moves.filter((m) => !WARM.test(m.name) && COOL.test(m.name));
  const main = moves.filter((m) => !WARM.test(m.name) && !COOL.test(m.name));
  const extras = (warm.length ? 5 : 0) + (cool.length ? 5 : 0);
  const out: PlanDayBlock[] = [];
  if (warm.length) out.push({ kind: "warmup", label: "WARM-UP", meta: "5 min", moves: warm });
  if (main.length)
    out.push({
      kind: "workout",
      label: "WORKOUT",
      meta: `${plural(main.length, "exercise", "exercises")} · ${minusMinutes(totalMinutes, extras)} min`,
      moves: main,
    });
  if (cool.length) out.push({ kind: "cooldown", label: "COOL-DOWN", meta: "5 min", moves: cool });
  return out;
}

/** Level chip: a plain "Beginner" plan reads "Beginner friendly". */
export function levelChip(level: string): string {
  return /^beginner$/i.test(level.trim()) ? "Beginner friendly" : level;
}

/** "BUILD MUSCLE · WEEK 3 · DAY 1" */
export function planDayKicker(planName: string, week: number, day: number): string {
  return `${planName} · Week ${week} · Day ${day}`.toUpperCase();
}

/** Week/day to show: the asked-for one if it exists, else your next day on this plan, else Week 1 Day 1. */
export function resolvePlanDayPosition(
  asked: { week?: number | undefined; day?: number | undefined },
  shape: { weeks: number; daysPerWeek: number },
  next: { week: number; day: number } | null,
): { week: number; day: number } {
  const okWeek = (w?: number) => typeof w === "number" && Number.isInteger(w) && w >= 1 && w <= shape.weeks;
  const okDay = (d?: number) => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= shape.daysPerWeek;
  const base = next ?? { week: 1, day: 1 };
  return { week: okWeek(asked.week) ? asked.week! : base.week, day: okDay(asked.day) ? asked.day! : base.day };
}
