import { describe, expect, it } from "vitest";
import { checkInSubline } from "../redesign-feed-view";
import { checkInPostWorkout, postSectionCanSave, sectionPreview } from "../post-sections";

const meta = { crew: "FitFam", time: "6:12 am", localDate: "2026-11-27", viewerToday: "2026-11-27", tag: "Workout" };
describe("new check-ins matching posts", () => {
  it("workout subline contains only crew and time", () => {
    expect(checkInSubline({ ...meta, hasWorkout: true })).toBe("FitFam · 6:12 am");
  });
  it("without a workout keeps the current tag and date behavior", () => {
    expect(checkInSubline({ ...meta, hasWorkout: false, tag: "Run" })).toBe("FitFam · 6:12 am · Run");
    expect(checkInSubline({ ...meta, hasWorkout: false, crew: null, localDate: "2026-11-26" })).toBe("Yesterday · Workout");
    expect(checkInSubline({ ...meta, hasWorkout: false, tag: null })).toBe("FitFam · 6:12 am");
  });
  it.each([1, 2, 3])("%i exercises has no See all", (count) => {
    expect(sectionPreview(Array.from({ length: count }, (_, i) => i)).more).toBe(false);
  });
  it.each([4, 6])("%i exercises exposes See all and previews three", (count) => {
    const preview = sectionPreview(Array.from({ length: count }, (_, i) => i));
    expect(preview.more).toBe(true);
    expect(preview.rows).toHaveLength(3);
    expect(preview.total).toBe(count);
  });
  it("Add to my workouts is hidden on own check-ins, visible on others", () => {
    expect(postSectionCanSave(true)).toBe(false);
    expect(postSectionCanSave(false)).toBe(true);
  });
  it("adapts the actual logged exercises without exposing weights", () => {
    const workout = checkInPostWorkout({ title: "Back day", summary: null, isMine: false, dayLabel: null, savedWorkoutId: null,
      exercises: [{ exerciseId: "row", name: "Row", imageStart: "image", logType: "reps", equipment: "barbell", sets: [{ weight: 100, unit: "kg", reps: 8, seconds: null, isPr: true }] }] }, "Workout");
    expect(workout.title).toBe("Back day");
    expect(workout.sets).toBe(1);
    expect(workout.moves[0]?.sets[0]).toEqual({ reps: 8, seconds: null, isPr: true });
  });
});