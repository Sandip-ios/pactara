import { describe, expect, it } from "vitest";
import { doseText, socialLine, tipText, topMuscleChips, workoutButtons, workoutStats } from "@/lib/new-workout-view";

describe("workout page stats", () => {
  it("Back day: 6 exercises, 20 sets, about 50 min", () => {
    const sets = [4, 3, 3, 3, 3, 4].map((s) => ({ sets: s }));
    expect(workoutStats(sets)).toEqual({ exercises: 6, sets: 20, minutes: 50 });
  });
  it("empty workout", () => expect(workoutStats([])).toEqual({ exercises: 0, sets: 0, minutes: 0 }));
});

describe("muscle chips", () => {
  it("top 3 primary muscles by exercise count, ties in first-seen order", () => {
    const items = [{ primary: ["back"] }, { primary: ["back", "biceps"] }, { primary: ["traps"] }, { primary: ["biceps"] }, { primary: ["abs"] }];
    expect(topMuscleChips(items)).toEqual(["Back", "Biceps", "Upper back"]);
  });
  it("counts a muscle once per exercise", () => {
    expect(topMuscleChips([{ primary: ["back", "back"] }, { primary: ["biceps"] }, { primary: ["biceps"] }])).toEqual(["Biceps", "Back"]);
  });
});

describe("sets × reps", () => {
  it("formats reps, each-side reps, seconds and plain sets", () => {
    expect(doseText({ sets: 4, reps: "8" })).toBe("4 × 8");
    expect(doseText({ sets: 3, reps: "10 each" })).toBe("3 × 10 each");
    expect(doseText({ sets: 3, seconds: 30 })).toBe("3 × 30 sec");
    expect(doseText({ sets: 3 })).toBe("3 sets");
    expect(doseText({ sets: 3, reps: "  " })).toBe("3 sets");
  });
  it("tips trim and cap at 120 characters", () => {
    expect(tipText("  ")).toBeNull();
    expect(tipText("x".repeat(150))?.length).toBe(120);
  });
});

describe("own vs others' buttons", () => {
  it("my own: Edit, menu with delete, no social line", () => {
    expect(workoutButtons({ isMine: true, saved: false, saves: 50, did: 3 })).toEqual({ secondary: "edit", menu: ["edit", "share", "delete"], showSocial: false });
  });
  it("someone else's: Save / Saved, share only", () => {
    expect(workoutButtons({ isMine: false, saved: false })).toEqual({ secondary: "save", menu: ["share"], showSocial: false });
    expect(workoutButtons({ isMine: false, saved: true }).secondary).toBe("saved");
    expect(workoutButtons({ isMine: false, saved: false, saves: 1204, did: 318 }).showSocial).toBe(true);
    expect(socialLine(1204, 318)).toBe("Saved by 1,204 · 318 did it");
  });
});
