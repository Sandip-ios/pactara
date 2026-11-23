import { describe, expect, it } from "vitest";
import {
  matchCardTags,
  newestSavedQuiz,
  parseSavedQuiz,
  quizSearchFor,
  sameAnswers,
  serializeSavedQuiz,
  showQuizMatchCard,
  type SavedQuiz,
} from "../plan-quiz-saved";

const saved: SavedQuiz = {
  answers: { goal: "fat_loss", experience: "new", equipment: ["none"], days: 5 },
  completedAt: "2026-11-23T20:00:00.000Z",
};

describe("saved quiz answers", () => {
  it("round-trips through the profile JSON (goal, exp, gear, days, completed_at)", () => {
    const row = serializeSavedQuiz(saved);
    expect(row).toEqual({ goal: "fat_loss", exp: "new", gear: ["none"], days: 5, completed_at: "2026-11-23T20:00:00.000Z" });
    expect(parseSavedQuiz(row)).toEqual(saved);
  });

  it("ignores incomplete or unknown answers", () => {
    expect(parseSavedQuiz(null)).toBeNull();
    expect(parseSavedQuiz({ goal: "fat_loss", exp: "new", gear: [], days: 5, completed_at: saved.completedAt })).toBeNull();
    expect(parseSavedQuiz({ goal: "yoga", exp: "new", gear: ["none"], days: 5, completed_at: saved.completedAt })).toBeNull();
    expect(parseSavedQuiz({ goal: "fat_loss", exp: "new", gear: ["none"], days: 7, completed_at: saved.completedAt })).toBeNull();
  });

  it("uses the local copy only when it is newer than the profile (a failed write)", () => {
    const older = { ...saved, completedAt: "2026-11-20T10:00:00.000Z" };
    expect(newestSavedQuiz(older, saved)).toBe(saved);
    expect(newestSavedQuiz(saved, older)).toBe(saved);
    expect(newestSavedQuiz(null, saved)).toBe(saved);
    expect(newestSavedQuiz(saved, null)).toBe(saved);
  });

  it("treats the same gear in another order as the same answers", () => {
    const a = { goal: "muscle", experience: "some", equipment: ["dumbbells", "band"], days: 3 } as const;
    expect(sameAnswers({ ...a, equipment: ["dumbbells", "band"] }, { ...a, equipment: ["band", "dumbbells"] })).toBe(true);
    expect(sameAnswers({ ...a, equipment: ["dumbbells"] }, { ...a, equipment: ["dumbbells"], days: 4 })).toBe(false);
  });
});

describe("match card", () => {
  it("shows only with saved answers and no active plan", () => {
    expect(showQuizMatchCard(saved, false)).toBe(true);
    expect(showQuizMatchCard(saved, true)).toBe(false);
    expect(showQuizMatchCard(null, false)).toBe(false);
  });

  it("joins the first two why tags", () => {
    expect(matchCardTags(["Lose fat", "No equipment", "Good for beginners", "5 days a week"])).toBe("Lose fat · No equipment");
    expect(matchCardTags(["Lose fat"])).toBe("Lose fat");
  });

  it("Retake opens Q1 prefilled; See all opens the results", () => {
    expect(quizSearchFor(saved.answers, 1)).toEqual({ step: 1, goal: "fat_loss", exp: "new", gear: "none", days: 5 });
    expect(quizSearchFor(saved.answers, 5).step).toBe(5);
  });
});
