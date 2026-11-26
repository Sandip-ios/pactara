import { describe, expect, it } from "vitest";
import { answerChips, browseWithDropped, daysStepState, droppedNote, quizStepKey } from "@/lib/new-quiz";
import { NO_FILTERS } from "@/lib/plan-filters";
import type { QuizAnswers } from "@/lib/plan-quiz";

const plan = (o: Partial<{ daysPerWeek: number; minutes: string; equipmentKey: "none" | "dumbbells" | "gym"; level: string; goal: "muscle" | "glutes" }>) => ({
  daysPerWeek: 5, minutes: "40", equipmentKey: "dumbbells" as const, level: "Beginner", goal: "muscle" as const, ...o,
});

describe("step order", () => {
  it("goes goal, experience, gear, days, then results", () => {
    expect([1, 2, 3, 4, 5].map(quizStepKey)).toEqual(["goal", "experience", "gear", "days", "results"]);
  });
});

describe("days step", () => {
  it("preselects the crew's rule", () => {
    const s = daysStepState(4, undefined);
    expect(s.value).toBe(4);
    expect(s.canContinue).toBe(true);
    expect(s.subtitle).toBe("We picked your crew's rule. Change it if you like.");
  });
  it("solo starts empty and disabled", () => {
    const s = daysStepState(null, undefined);
    expect(s.value).toBeUndefined();
    expect(s.canContinue).toBe(false);
    expect(s.subtitle).toBe("Pick what fits your week.");
  });
});

describe("browse with my answers", () => {
  const a: QuizAnswers = { goal: "muscle", experience: "new", equipment: ["dumbbells"], days: 4 };
  it("drops days and says so", () => {
    const r = browseWithDropped([plan({})], a);
    expect(r.dropped).toEqual(["days"]);
    expect(droppedNote(r.dropped, a)).toBe("No plan matched 4 days a week too, so we left that filter off.");
  });
  it("no note when nothing was dropped", () => {
    const r = browseWithDropped([plan({ daysPerWeek: 4 })], a);
    expect(r.dropped).toEqual([]);
    expect(droppedNote(r.dropped, a)).toBeNull();
  });
  it("chips name each answer", () => {
    const labels = answerChips({ ...NO_FILTERS, goal: ["muscle"], equipment: ["dumbbells"], level: ["beginner"] }).map((c) => c.label);
    expect(labels).toEqual(["Build muscle", "Dumbbells", "Beginner"]);
  });
});

import { discoverCardMatch as _dcm } from "@/lib/new-quiz";
describe("discoverCardMatch", () => {
  const r = (slug: string) => ({ plan: { slug } });
  const m = { best: r("build-muscle"), also: [r("glute-builder"), r("strength-foundations")] };
  it("shows the next-best match when the best is my active plan", () => {
    expect(_dcm(m, "build-muscle").plan.slug).toBe("glute-builder");
  });
  it("keeps the best match when it is not my plan", () => {
    expect(_dcm(m, "home-no-equipment").plan.slug).toBe("build-muscle");
    expect(_dcm(m, null).plan.slug).toBe("build-muscle");
  });
});
