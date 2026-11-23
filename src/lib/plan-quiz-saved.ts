/**
 * Saved "Find your plan" answers (profiles.plan_quiz, with a local copy when
 * the profile write fails) and the rules for the match card on Discover and
 * the Workouts tab. Pure: the best match itself always comes from matchPlans.
 */
import { parseEquipment, parseExperience, parseQuizDays, parseQuizGoal, type QuizAnswers } from "@/lib/plan-quiz";

export type SavedQuiz = { answers: QuizAnswers; completedAt: string };

/** What goes into profiles.plan_quiz (and the local copy). */
export function serializeSavedQuiz(s: SavedQuiz) {
  return {
    goal: s.answers.goal,
    exp: s.answers.experience,
    gear: [...s.answers.equipment],
    days: s.answers.days,
    completed_at: s.completedAt,
  };
}

/** Stored JSON back to answers; anything incomplete or unknown is null. */
export function parseSavedQuiz(v: unknown): SavedQuiz | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const goal = parseQuizGoal(o["goal"]);
  const experience = parseExperience(o["exp"]);
  const gearRaw = o["gear"];
  const equipment = parseEquipment(Array.isArray(gearRaw) ? gearRaw.join(",") : gearRaw);
  const days = parseQuizDays(o["days"]);
  const completedAt = typeof o["completed_at"] === "string" && !Number.isNaN(Date.parse(o["completed_at"])) ? o["completed_at"] : null;
  if (!goal || !experience || equipment.length === 0 || !days || !completedAt) return null;
  return { answers: { goal, experience, equipment, days }, completedAt };
}

/** Profile and local copy: the one finished last wins (a failed profile write leaves the local one newer). */
export function newestSavedQuiz(profile: SavedQuiz | null, local: SavedQuiz | null): SavedQuiz | null {
  if (!profile) return local;
  if (!local) return profile;
  return Date.parse(local.completedAt) > Date.parse(profile.completedAt) ? local : profile;
}

export function sameAnswers(a: QuizAnswers, b: QuizAnswers): boolean {
  return (
    a.goal === b.goal &&
    a.experience === b.experience &&
    a.days === b.days &&
    a.equipment.length === b.equipment.length &&
    a.equipment.every((k) => b.equipment.includes(k))
  );
}

/** The match card replaces the quiz entry card only with saved answers and no active plan. */
export function showQuizMatchCard(saved: SavedQuiz | null, hasActivePlan: boolean): boolean {
  return !!saved && !hasActivePlan;
}

/** The card's tag line: the first two "why" tags. */
export function matchCardTags(why: string[]): string {
  return why.slice(0, 2).join(" · ");
}

/** /find-plan search for the saved answers: step 1 for Retake quiz, step 5 for the results. */
export function quizSearchFor(a: QuizAnswers, step: 1 | 5) {
  return { step, goal: a.goal, exp: a.experience, gear: a.equipment.join(","), days: a.days };
}

export const savedQuizLocalKey = (userId: string) => `pactara.planQuiz.${userId}`;
