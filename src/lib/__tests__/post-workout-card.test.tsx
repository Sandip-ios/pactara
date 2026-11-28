import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WorkoutDetail } from "../lifts.functions";

vi.mock("@/components/redesign/post/PostAttachmentSave", () => ({
  PostAttachmentSave: () => <button>Add to my workouts</button>,
}));
vi.mock("@/components/redesign/RedesignCheckInSheets", () => ({
  RedesignWorkoutSheet: () => null,
}));

import { PostWorkoutCard } from "@/components/redesign/post/PostSections";

const detail: WorkoutDetail = {
  title: "Lower body",
  summary: { exercises: 1, sets: 1, minutes: 20, volume: 0, unit: "kg", items: [], prs: [] },
  exercises: [{ exerciseId: "squat", name: "Barbell Back Squat", imageStart: null, logType: "reps", equipment: "barbell", sets: [{ weight: 100, unit: "kg", reps: 5, seconds: null, isPr: true }] }],
  isMine: false,
  dayLabel: null,
  savedWorkoutId: null,
};

describe("shared workout attachment order", () => {
  it("puts New PR after the exercise rows and before Add to my workouts", () => {
    const html = renderToStaticMarkup(
      <PostWorkoutCard
        workout={{ source: "session", title: "Lower body", minutes: 20, sets: 1, prCount: 1, moves: [{ exerciseId: "squat", name: "Barbell Back Squat", imageStart: null, logType: "reps", sets: [{ reps: 5, seconds: null, isPr: true }] }] }}
        isMine={false}
        author={null}
        postId="check-in"
        checkIn={{ card: { kind: "workout", label: "WORKOUT", title: "Lower body", line: "1 exercise · 1 set", pr: true }, planSlug: null, detail }}
      />,
    );
    const exercise = html.indexOf("Barbell Back Squat");
    const pr = html.indexOf("New PR");
    const save = html.indexOf("Add to my workouts");
    expect(exercise).toBeGreaterThanOrEqual(0);
    expect(pr).toBeGreaterThan(exercise);
    expect(save).toBeGreaterThan(pr);
  });
});
