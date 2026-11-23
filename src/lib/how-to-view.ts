/**
 * Exercise How to page: pure content rules.
 * Plan moves use our own copy (plain line, mistakes, easier/harder) and hide a
 * section that has no copy yet; library-only exercises use RepDB's description,
 * steps and tips, with an easier beginner version from the same variation group.
 */
import type { LibraryExercise } from "@/lib/exercise-library";
import type { MoveOption, PlanMove } from "@/lib/workout-plans";

/** A last step that only says to repeat ("Repeat.", "Repeat for the desired number of reps.") adds nothing. */
const GENERIC_REPEAT = /^repeat(?:\s+for\s+(?:the\s+)?(?:desired|recommended|prescribed|planned)\s+(?:number\s+of\s+)?(?:reps|repetitions))?\s*\.?$/i;

export function cleanSteps(steps: string[]): string[] {
  const out = steps.map((s) => s.trim()).filter(Boolean);
  const last = out[out.length - 1];
  if (last && GENERIC_REPEAT.test(last)) out.pop();
  return out;
}

/** The first plan move that uses this library exercise. */
export function planMoveFor(plans: { days: { moves: PlanMove[] }[] }[], exerciseId: string): PlanMove | null {
  for (const p of plans) for (const d of p.days) for (const m of d.moves) if (m.exercise_id === exerciseId) return m;
  return null;
}

/**
 * A beginner exercise from the same RepDB variation group, when this one isn't
 * already beginner. Closest first: same kind of logging (reps vs holds), then
 * same equipment, then by name.
 */
export function easierInGroup(ex: LibraryExercise, library: LibraryExercise[]): LibraryExercise | null {
  if (!ex.variationGroup || ex.difficulty === "beginner") return null;
  const score = (o: LibraryExercise) => (o.logType === ex.logType ? 0 : 2) + (o.equipment === ex.equipment ? 0 : 1);
  return (
    library
      .filter((o) => o.id !== ex.id && !o.custom && o.variationGroup === ex.variationGroup && o.difficulty === "beginner")
      .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))[0] ?? null
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type FitOption = { name: string; note: string | null; exerciseId: string | null };
export type HowToView = {
  title: string;
  plain: string | null;
  primary: string[];
  secondary: string[];
  steps: string[];
  mistakes: { mistake: string; fix: string }[] | null;
  tips: string[] | null;
  easier: FitOption | null;
  harder: FitOption | null;
};

const option = (o: MoveOption | null | undefined): FitOption | null =>
  o?.name ? { name: o.name, note: o.note ?? null, exerciseId: o.exercise_id ?? null } : null;

const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export function buildHowTo(input: {
  ex: LibraryExercise;
  planMove: PlanMove | null;
  detail: { instructions: string[]; tips: string[]; description: string | null } | null;
  library: LibraryExercise[];
  equipmentLabel: (e: LibraryExercise["equipment"]) => string;
}): HowToView {
  const { ex, planMove, detail, library } = input;
  const primary = ex.primary.map(cap);
  const secondary = ex.secondary.filter((m) => !ex.primary.includes(m)).map(cap);
  const steps = cleanSteps(detail?.instructions ?? []);
  if (planMove) {
    return {
      title: planMove.name,
      plain: planMove.plain || null,
      primary,
      secondary,
      steps,
      mistakes: planMove.mistakes?.length ? planMove.mistakes : null,
      tips: null,
      easier: option(planMove.easier),
      harder: option(planMove.harder),
    };
  }
  const easy = easierInGroup(ex, library);
  return {
    title: ex.name,
    plain: detail?.description ?? null,
    primary,
    secondary,
    steps,
    mistakes: null,
    tips: detail?.tips?.length ? detail.tips : null,
    easier: easy
      ? { name: easy.name, note: [LEVEL[easy.difficulty ?? ""] ?? null, input.equipmentLabel(easy.equipment)].filter(Boolean).join(" · "), exerciseId: easy.id }
      : null,
    harder: null,
  };
}
