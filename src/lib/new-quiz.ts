/**
 * New-version "Find your plan" rules on top of plan-quiz.ts (pure): step order,
 * the days step's crew preselect, the browse filters with what was dropped, and
 * the answer chips on Discover's filtered mode.
 */
import { filterPlans, type FilterablePlan, type PlanFilters } from "@/lib/plan-filters";
import { QUIZ_GOALS, presetDays, quizToFilters, type QuizAnswers, type QuizDays } from "@/lib/plan-quiz";
import { EQUIPMENT_LABEL, type EquipmentKey } from "@/lib/workout-plans";

/** Canvas order = plan-quiz.ts order: ?step=1..4, results at 5. */
export const NEW_QUIZ_STEPS = ["goal", "experience", "gear", "days"] as const;
export const quizStepKey = (step: number) => NEW_QUIZ_STEPS[step - 1] ?? "results";

/** Days step: crew members get their crew's rule preselected; solo starts empty and can't continue. */
export function daysStepState(crewDays: number | null, picked: number | undefined) {
  const preset = crewDays == null ? null : presetDays([crewDays]);
  const value: QuizDays | number | undefined = picked ?? preset ?? undefined;
  return {
    value,
    subtitle: crewDays == null ? "Pick what fits your week." : "We picked your crew's rule. Change it if you like.",
    canContinue: value !== undefined,
  };
}

export type DroppableKey = "days" | "level" | "equipment";

/** Browse filters (Days, then Level, then Equipment dropped until a plan shows) and which were dropped. */
export function browseWithDropped(plans: FilterablePlan[], a: QuizAnswers): { filters: PlanFilters; dropped: DroppableKey[] } {
  let f = quizToFilters(a);
  const dropped: DroppableKey[] = [];
  for (const k of ["days", "level", "equipment"] as const) {
    if (filterPlans(plans, f).length > 0) break;
    f = { ...f, [k]: [] };
    dropped.push(k);
  }
  return { filters: f, dropped };
}

const LEVEL_WORD: Record<QuizAnswers["experience"], string> = { new: "Beginner", some: "Beginner", regular: "Intermediate" };

function droppedLabel(k: DroppableKey, a: QuizAnswers): string {
  if (k === "days") return `${a.days} days a week`;
  if (k === "level") return LEVEL_WORD[a.experience];
  return a.equipment.map((e) => EQUIPMENT_LABEL[e]).join(" + ");
}

/** "No plan matched 4 days a week too, so we left that filter off." */
export function droppedNote(dropped: DroppableKey[], a: QuizAnswers | null): string | null {
  if (!a || dropped.length === 0) return null;
  const labels = dropped.map((k) => droppedLabel(k, a));
  const what = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
  return `No plan matched ${what} too, so we left ${dropped.length === 1 ? "that filter" : "those filters"} off.`;
}

export const parseDropped = (v: unknown): DroppableKey[] =>
  String(v ?? "").split(",").filter((k): k is DroppableKey => k === "days" || k === "level" || k === "equipment");

export type AnswerChip = { id: string; label: string; remove: (f: PlanFilters) => PlanFilters };

/** One chip per applied answer: goal, each piece of gear, level, days. */
export function answerChips(f: PlanFilters): AnswerChip[] {
  const out: AnswerChip[] = [];
  for (const g of f.goal) {
    const label = QUIZ_GOALS.find((q) => q.goal === g)?.label ?? g;
    out.push({ id: `goal:${g}`, label, remove: (x) => ({ ...x, goal: x.goal.filter((v) => v !== g) }) });
  }
  for (const e of f.equipment) {
    out.push({ id: `gear:${e}`, label: EQUIPMENT_LABEL[e as EquipmentKey] ?? e, remove: (x) => ({ ...x, equipment: x.equipment.filter((v) => v !== e) }) });
  }
  if (f.level.length) out.push({ id: "level", label: f.level.includes("intermediate") ? "Intermediate" : "Beginner", remove: (x) => ({ ...x, level: [] }) });
  for (const d of f.days) out.push({ id: `days:${d}`, label: `${d} days a week`, remove: (x) => ({ ...x, days: x.days.filter((v) => v !== d) }) });
  return out;
}

/** "2 plans fit your answers" */
export const fitCountLine = (n: number) => `${n} ${n === 1 ? "plan fits" : "plans fit"} your answers`;
